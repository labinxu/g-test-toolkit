import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import { SettingsService } from 'src/settings/settings.service';
import {
  CORE_BE_ENDPOINTS,
  type ApiTestCaseInput,
  type ApiTestCaseResult,
  type CoreBeRunRequest,
  type CoreBeRunResponse,
  type CoreBeApiEndpoint,
  type ExecutionMode,
  type ApiParamConfig,
} from './corebe.schema';
import {
  NOTIF_ENDPOINTS,
  type ApiEndpoint as NotifApiEndpoint,
} from './notif.schema';

interface ApiCsvRow {
  Category: string;
  ServiceClass: string;
  Path: string;
  BaseHost: string;
  Notes: string;
}

@Injectable()
export class ApiTestsService {
  private readonly logger: CustomLogger;

  constructor(
    private readonly loggerService: LoggerService,
    private readonly settingsService: SettingsService,
  ) {
    this.logger = this.loggerService.createLogger('ApiTestsService');
  }

  /**
   * Generate API test skeleton files from an apis.csv content.
   *
   * Files will be created under:
   *   workspace/users/{username}/cases/api-tests/{category}/{serviceClass}.api.test.ts
   */
  async generateFromCsv(csvContent: string, username: string) {
    const rows = this.parseCsv(csvContent);
    if (rows.length === 0) {
      return { count: 0, files: [] as string[] };
    }

    const workspaceRoot = path.resolve(
      process.cwd(),
      'workspace',
      'users',
      username,
      'cases',
      'api-tests',
    );
    const filesCreated: string[] = [];

    // Group by Category + ServiceClass
    const groups = new Map<string, ApiCsvRow[]>();
    for (const row of rows) {
      const key = `${row.Category}::${row.ServiceClass}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    for (const [key, group] of groups.entries()) {
      const [category, serviceClass] = key.split('::');
      const safeCategory = this.sanitizeName(category || 'default');
      const safeService = this.sanitizeName(serviceClass || 'ApiService');

      const dir = path.join(workspaceRoot, safeCategory);
      await fs.mkdir(dir, { recursive: true });

      const filePath = path.join(dir, `${safeService}.api.test.ts`);
      const relPath = path.relative(process.cwd(), filePath);

      const content = this.buildFileContent(category, serviceClass, group);
      await fs.writeFile(filePath, content, 'utf-8');

      filesCreated.push(relPath);
      this.logger.info(`Generated API test skeleton: ${relPath}`);
    }

    return { count: filesCreated.length, files: filesCreated };
  }

  private buildFileContent(category: string, serviceClass: string, rows: ApiCsvRow[]) {
    const header = [
      '// Auto-generated API test skeletons',
      `// Category: ${category}`,
      `// Service: ${serviceClass}`,
      `// Generated at: ${new Date().toISOString()}`,
      '',
      "import { describe, it, expect } from 'core-lib';",
      '',
      '// NOTE:',
      '// - 该文件设计为通过当前 g-test-toolkit 的沙箱 + core-lib 运行。',
      '// - HTTP 客户端已在下方预填：从全局 params.apiTestConfig 中读取配置。',
      '//   建议在「Parameters」页面配置 API 测试环境（如 baseUrl、默认 Header），',
      '//   后端可在运行用例前把这些参数注入到 params.apiTestConfig 中，而不是使用环境变量。',
      '',
      'type ApiTestConfig = {',
      '  baseUrl: string;',
      '  defaultHeaders?: Record<string, string>;',
      '  sampleLivePostId?: string; // Optional: 用于直播相关示例测试的 postId',
      '};',
      '',
      '/**',
      ' * 从沙箱全局参数中读取 API 测试配置。',
      ' * 约定：后端在运行前注入 globalThis.params.apiTestConfig，内容来源于 Parameters 页面配置并存放于后端数据库。',
      ' */',
      'function getApiTestConfig(): ApiTestConfig {',
      '  const anyGlobal = globalThis as any;',
      '  const cfg = anyGlobal?.params?.apiTestConfig as ApiTestConfig | undefined;',
      "  if (!cfg || !cfg.baseUrl) {",
      "    throw new Error('apiTestConfig.baseUrl is not configured. 请在 Parameters 页面配置 API 测试环境并由后端注入。');",
      '  }',
      '  return cfg;',
      '}',
      '',
      'async function apiRequest(path: string, init: RequestInit = {}) {',
      '  const { baseUrl, defaultHeaders } = getApiTestConfig();',
      "  const url = `${baseUrl.replace(/\\/$/, '')}${path}`;",
      '  const mergedHeaders: Record<string, string> = {',
      '    ...(defaultHeaders || {}),',
      "    ...(init.headers as Record<string, string> | undefined || {}),",
      '  };',
      '  const res = await fetch(url, {',
      '    ...init,',
      '    headers: mergedHeaders,',
      '  });',
      '  return res;',
      '}',
      '',
      'async function apiGet(path: string, init: RequestInit = {}) {',
      "  return apiRequest(path, { ...init, method: init.method || 'GET' });",
      '}',
      '',
      'async function apiPost(path: string, body?: any, init: RequestInit = {}) {',
      '  const headers: Record<string, string> = {',
      "    'content-type': 'application/json',",
      "    ...(init.headers as Record<string, string> | undefined || {}),",
      '  };',
      "  return apiRequest(path, { ...init, method: 'POST', headers, body: body == null ? undefined : JSON.stringify(body) });",
      '}',
      '',
    ].join('\n');

    const blocks = rows.map((row, index) => {
      const safePath = row.Path.replace(/'/g, "\\'");
      const safeCategory = row.Category.replace(/'/g, "\\'");
      const note = row.Notes ? `// ${row.Notes}` : '';

      const path = row.Path;
      const isLiveCategory = (row.Category || '').toLowerCase() === 'live';
      const isLiveStreamDetail =
        isLiveCategory && path.startsWith('/u/live/stream/');
      const isLiveChat =
        isLiveCategory && path.startsWith('/u/live/chat/');

      // 针对直播详情接口，生成更具体的示例
      if (isLiveStreamDetail) {
        return [
          note,
          `describe('[${safeCategory}] ${safePath}', () => {`,
          `  it('example: ${safePath} returns live info with broadcast field', async () => {`,
          '    const cfg = getApiTestConfig() as any;',
          "    const sampleId = (cfg.sampleLivePostId as string | undefined) || '<REPLACE_WITH_LIVE_POST_ID>';",
          "    const requestPath = `/u/live/stream/${sampleId}`;",
          '    const res = await apiGet(requestPath);',
          '    expect(res.status).toBe(200);',
          "    const contentType = res.headers.get('content-type') || '';",
          '    const data = contentType.includes("application/json")',
          '      ? await res.json().catch(() => null)',
          '      : await res.text().catch(() => null);',
          '    expect(data).not.toBeNull();',
          '    if (data && typeof data === "object") {',
          '      // 针对 GETTR API，一般为 { result: { ... } } 结构',
          '      const root: any = data as any;',
          '      const result = root.result ?? root.data ?? root;',
          '      expect(result).toBeDefined();',
          '      // 如果返回中带有 broadcast 字段，可以在此加更强的断言：',
          '      if (result.broadcast) {',
          '        expect(result.broadcast).toHaveProperty("isLive");',
          '      }',
          '    }',
          '  });',
          '});',
          '',
        ].join('\n');
      }

      // 针对直播聊天接口，生成更具体的示例
      if (isLiveChat) {
        return [
          note,
          `describe('[${safeCategory}] ${safePath}', () => {`,
          `  it('example: ${safePath} returns chat replay or realtime messages', async () => {`,
          '    const cfg = getApiTestConfig() as any;',
          "    const sampleId = (cfg.sampleLivePostId as string | undefined) || '<REPLACE_WITH_LIVE_POST_ID>';",
          "    const url = `/u/live/chat/${sampleId}?startts=0&cursor=&max=50`;",
          '    const res = await apiGet(url);',
          '    expect(res.status).toBe(200);',
          "    const contentType = res.headers.get('content-type') || '';",
          '    if (contentType.includes("application/json")) {',
          '      const data = await res.json().catch(() => null);',
          '      expect(data).not.toBeNull();',
          '      // 根据后端定义，通常会有 messages / list 字段存放聊天记录',
          '      const root: any = data as any;',
          '      const msgs = root.messages ?? root.result ?? root.data ?? null;',
          '      expect(msgs).not.toBeUndefined();',
          '    } else {',
          '      const text = await res.text();',
          '      expect(text).toBeTruthy();',
          '    }',
          '  });',
          '});',
          '',
        ].join('\n');
      }

      // 默认：第一个接口给一个通用的完整示例，其它保持轻量骨架
      if (index === 0) {
        return [
          note,
          `describe('[${safeCategory}] ${safePath}', () => {`,
          `  it('example: ${safePath} should return 200 and a non-empty body', async () => {`,
          `    const res = await apiGet('${safePath}');`,
          '    expect(res.status).toBe(200);',
          "    const contentType = res.headers.get('content-type') || '';",
          '    if (contentType.includes("application/json")) {',
          '      const data = await res.json().catch(() => null);',
          '      expect(data).not.toBeNull();',
          '      // TODO: 针对该接口的数据结构补充更具体的字段断言，例如：',
          '      // expect(data).toHaveProperty("result");',
          '      // expect(data.result).toBeDefined();',
          '    } else {',
          '      const text = await res.text();',
          '      expect(text).toBeTruthy();',
          '    }',
          '  });',
          '});',
          '',
        ].join('\n');
      }

      return [
        note,
        `describe('[${safeCategory}] ${safePath}', () => {`,
        `  it('case ${index + 1}: ${safePath}', async () => {`,
        '    // TODO: implement API call and assertions',
        `    // BaseHost: ${row.BaseHost}`,
        '    // 示例：',
        "    // const res = await apiGet('...');",
        "    // expect(res.status).toBe(200);",
        '  });',
        '});',
        '',
      ].join('\n');
    });

    return `${header}\n${blocks.join('\n')}`;
  }

  private sanitizeName(name: string) {
    const cleaned = name
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+/, '')
      .replace(/_+$/, '');
    return cleaned || 'default';
  }

  /**
   * Minimal CSV parser for apis.csv format.
   * Supports quotes and commas inside quoted fields, no multiline fields.
   */
  private parseCsv(content: string): ApiCsvRow[] {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return [];

    const headers = this.splitCsvLine(lines[0]);
    const idxCategory = headers.indexOf('Category');
    const idxService = headers.indexOf('ServiceClass');
    const idxPath = headers.indexOf('Path');
    const idxBaseHost = headers.indexOf('BaseHost');
    const idxNotes = headers.indexOf('Notes');

    const rows: ApiCsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this.splitCsvLine(lines[i]);
      const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx] : '');

      const row: ApiCsvRow = {
        Category: get(idxCategory),
        ServiceClass: get(idxService),
        Path: get(idxPath),
        BaseHost: get(idxBaseHost),
        Notes: get(idxNotes),
      };

      if (row.Path) {
        rows.push(row);
      }
    }

    return rows;
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }

    result.push(current);
    return result.map((v) => v.trim());
  }

  /**
   * -------- Core-be regression test helpers --------
   */

  getCoreBeSchema() {
    return {
      endpoints: CORE_BE_ENDPOINTS,
    };
  }

  getNotifSchema() {
    return {
      endpoints: NOTIF_ENDPOINTS,
    };
  }

  private async runModuleTests(
    endpoints: CoreBeApiEndpoint[] | NotifApiEndpoint[],
    input: CoreBeRunRequest,
    userId: number,
  ): Promise<CoreBeRunResponse> {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('Invalid request body');
    }
    if (!input.endpointId) {
      throw new BadRequestException('endpointId is required');
    }
    if (!Array.isArray(input.cases) || input.cases.length === 0) {
      throw new BadRequestException('cases must be a non-empty array');
    }

    const endpoint = endpoints.find((e) => e.id === input.endpointId);
    if (!endpoint) {
      throw new BadRequestException(`Unknown endpointId: ${input.endpointId}`);
    }

    const mode: ExecutionMode =
      input.mode === 'batch' || input.mode === 'sequence'
        ? input.mode
        : 'single';

    const userCfg = await this.settingsService.getApiTestsConfig(userId);
    const baseUrlRaw = (input.baseUrlOverride || userCfg.baseUrl || '').trim();
    if (!baseUrlRaw) {
      throw new BadRequestException(
        'Base URL is not configured. Please set it in Settings → Parameters → API Tests.',
      );
    }
    const baseUrl = baseUrlRaw.replace(/\/+$/, '');

    const defaultHeaders = userCfg.defaultHeaders || {};
    const overrideHeaders = input.headersOverride || {};

    const cases: ApiTestCaseInput[] = input.cases.map((c, idx) => ({
      id: String(c?.id ?? `case-${idx + 1}`),
      title:
        typeof c?.title === 'string' && c.title.trim().length > 0
          ? c.title.trim()
          : `Case #${idx + 1}`,
      paramsOverride:
        c && typeof c.paramsOverride === 'object' && c.paramsOverride
          ? c.paramsOverride
          : {},
    }));

    const runOne = async (
      testCase: ApiTestCaseInput,
    ): Promise<ApiTestCaseResult> => {
      const startedAt = Date.now();
      let url = '';
      let status = 0;
      let ok = false;
      let error: string | undefined;
      let bodyPreview: string | null = null;
      let bodyText = '';
      let truncated = false;
      const requestHeaders: Record<string, string> = {};
      const responseHeaders: Record<string, string> = {};

      try {
        const { url: fullUrl, headers, bodyInit } = this.buildCoreBeRequest(
          endpoint,
          baseUrl,
          defaultHeaders,
          {
            overrideParams: testCase.paramsOverride,
            headersOverride: overrideHeaders,
          },
        );

        url = fullUrl;
        Object.assign(requestHeaders, headers);

        if (bodyInit != null) {
          if (typeof bodyInit === 'string') {
            bodyPreview =
              bodyInit.length > 2000 ? `${bodyInit.slice(0, 2000)}…` : bodyInit;
          } else {
            const text = JSON.stringify(bodyInit);
            bodyPreview = text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
          }
        }

        const fetchInit: any = {
          method: endpoint.method,
          headers,
        };
        if (
          endpoint.method !== 'GET' &&
          endpoint.method !== 'DELETE' &&
          bodyInit != null
        ) {
          fetchInit.body =
            typeof bodyInit === 'string'
              ? bodyInit
              : JSON.stringify(bodyInit);
        }

        const res = await fetch(fullUrl, fetchInit as any);

        status = res.status;
        ok = res.ok;
        res.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const json = await res.json().catch(() => null);
          const text = json == null ? '' : JSON.stringify(json, null, 2);
          if (text.length > 4000) {
            bodyText = `${text.slice(0, 4000)}…`;
            truncated = true;
          } else {
            bodyText = text;
          }
        } else {
          const text = await res.text().catch(() => '');
          if (text.length > 4000) {
            bodyText = `${text.slice(0, 4000)}…`;
            truncated = true;
          } else {
            bodyText = text;
          }
        }
      } catch (e: any) {
        error = e?.message || String(e);
        ok = false;
      }

      const durationMs = Date.now() - startedAt;
      return {
        id: testCase.id,
        title: testCase.title,
        ok,
        status,
        durationMs,
        error,
        request: {
          method: endpoint.method,
          url,
          headers: requestHeaders,
          bodyPreview,
        },
        response: {
          status,
          headers: responseHeaders,
          bodyText,
          truncated,
        },
      };
    };

    let results: ApiTestCaseResult[];
    if (mode === 'sequence') {
      results = [];
      for (const c of cases) {
        // sequential execution
        const r = await runOne(c);
        results.push(r);
      }
    } else {
      results = await Promise.all(cases.map((c) => runOne(c)));
    }

    return {
      endpointId: endpoint.id,
      baseUrl,
      mode,
      results,
    };
  }

  async runCoreBeTests(
    input: CoreBeRunRequest,
    userId: number,
  ): Promise<CoreBeRunResponse> {
    return this.runModuleTests(CORE_BE_ENDPOINTS, input, userId);
  }

  async runNotifTests(
    input: CoreBeRunRequest,
    userId: number,
  ): Promise<CoreBeRunResponse> {
    return this.runModuleTests(NOTIF_ENDPOINTS, input, userId);
  }

  private buildCoreBeRequest(
    endpoint: CoreBeApiEndpoint,
    baseUrl: string,
    defaultHeaders: Record<string, string>,
    opts: {
      overrideParams: Record<string, unknown>;
      headersOverride?: Record<string, string>;
    },
  ): {
    url: string;
    headers: Record<string, string>;
    bodyInit: unknown | null;
  } {
    const headers: Record<string, string> = { ...defaultHeaders };

    const pathParams: Record<string, unknown> = {};
    const queryParams: Record<string, unknown> = {};
    const bodyParams: Record<string, unknown> = {};

    const getValueForParam = (param: ApiParamConfig): unknown => {
      if (Object.prototype.hasOwnProperty.call(opts.overrideParams, param.name)) {
        return opts.overrideParams[param.name];
      }
      return param.defaultValue;
    };

    for (const p of endpoint.params) {
      const raw = getValueForParam(p);
      if (raw === undefined) continue;

      let value: unknown = raw;
      if (p.type === 'number' && typeof raw === 'string' && raw !== '') {
        const n = Number(raw);
        value = Number.isFinite(n) ? n : raw;
      } else if (p.type === 'boolean' && typeof raw === 'string' && raw !== '') {
        const lowered = raw.toLowerCase();
        value = lowered === 'true' || lowered === '1';
      } else if (p.type === 'json' && typeof raw === 'string' && raw.trim()) {
        try {
          value = JSON.parse(raw);
        } catch {
          value = raw;
        }
      }

      switch (p.location) {
        case 'path':
          pathParams[p.name] = value;
          break;
        case 'query':
          queryParams[p.name] = value;
          break;
        case 'header':
          if (value != null) {
            headers[p.name] = String(value);
          }
          break;
        case 'body':
          bodyParams[p.name] = value;
          break;
        default:
          break;
      }
    }

    if (opts.headersOverride) {
      for (const [k, v] of Object.entries(opts.headersOverride)) {
        if (typeof k === 'string' && typeof v === 'string') {
          headers[k] = v;
        }
      }
    }

    let pathStr = endpoint.path;
    pathStr = pathStr.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
      const val = pathParams[key];
      return encodeURIComponent(val == null ? '' : String(val));
    });

    const url = new URL(baseUrl + pathStr);
    for (const [k, v] of Object.entries(queryParams)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item == null) continue;
          url.searchParams.append(k, String(item));
        }
      } else {
        url.searchParams.append(k, String(v));
      }
    }

    let bodyInit: unknown | null = null;
    if (Object.keys(bodyParams).length > 0) {
      bodyInit = bodyParams;
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
    }

    return {
      url: url.toString(),
      headers,
      bodyInit,
    };
  }
}
