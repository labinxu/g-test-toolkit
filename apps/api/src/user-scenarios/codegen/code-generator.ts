import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StepBindingV1, StepCheckRule } from '../action-catalog';
import { ActionCatalogService } from '../action-catalog.service';
import { UserScenario } from '../entities/user-scenario.entity';
import { UserScenarioSuite } from '../entities/user-scenario-suite.entity';
import { EnvTemplate } from '../entities/env-template.entity';
import { buildApiStepLines } from './api-generator';
import { type UsedPage } from './ui-helpers';
import { getModuleNameForPlatform, normalizePlatform, parseSharedPreSteps, sanitizeName } from '../utils/normalize';

export class UserScenarioCodeGenerator {
  constructor(
    private readonly caseRepo: Repository<UserScenario>,
    private readonly suiteRepo: Repository<UserScenarioSuite>,
    private readonly envTemplateRepo: Repository<EnvTemplate>,
    private readonly actionCatalog: ActionCatalogService,
  ) {}

  private getModuleNameForPlatform(platform: string | null | undefined) {
    return getModuleNameForPlatform(platform);
  }

  private normalizePlatform(platform: string | null | undefined) {
    return normalizePlatform(platform);
  }

  private sanitizeName(value: string | null | undefined) {
    return sanitizeName(value);
  }

  private parseSharedPreSteps(raw?: string | null) {
    return parseSharedPreSteps(raw);
  }

  async generateCodeForCase(
    id: number,
    username: string,
    envTemplateId?: number | null,
  ) {
    const entity = await this.caseRepo.findOne({
      where: { id },
      relations: ['steps'],
      order: { steps: { order: 'ASC' as any } },
    });
    if (!entity) {
      throw new NotFoundException(`UserScenario ${id} not found`);
    }

    // 若用例已归属套件，则改为生成套件代码并返回对应文件路径
    if (entity.suiteId) {
      return this.generateCodeForSuite(entity.suiteId, username, envTemplateId);
    }

    const safeUser = sanitizeName(username || 'default');
    const platform = normalizePlatform(entity.platform);
    const isApiPlatform = platform.includes('-api-');
    const moduleName = sanitizeName(entity.module || 'live-stream');
    // 目录结构：workspace/users/<user>/cases/<platform>/<module>/<submenu>/<code>.ts
    const root = path.resolve(
      process.cwd(),
      'workspace',
      'users',
      safeUser,
      'cases',
      platform,
      moduleName,
    );
    const submenu = entity.submenu || 'general';
    const safeSubmenu = sanitizeName(submenu);
    const dir = path.join(root, safeSubmenu);
    await fs.promises.mkdir(dir, { recursive: true });

    const safeCode = sanitizeName(entity.code || `case-${id}`);
    const filePath = path.join(dir, `${safeCode}.ts`);
    const relPath = path.relative(process.cwd(), filePath);

    const lines: string[] = [
      '// Auto-generated live stream user case',
      `// Code: ${entity.code}`,
      entity.feature ? `// Feature: ${entity.feature}` : '',
      entity.csvId ? `// CSV ID: ${entity.csvId}` : '',
      `// Generated at: ${new Date().toISOString()}`,
      '',
    ].filter(Boolean) as string[];

    if (entity.description) {
      lines.push('// Description:');
      const descLines = String(entity.description)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const ln of descLines) {
        lines.push(`//   ${ln}`);
      }
      lines.push('');
    }

    if (entity.acceptanceCriteria) {
      lines.push('// Acceptance Criteria:');
      const acLines = String(entity.acceptanceCriteria)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const ln of acLines) {
        lines.push(`//   ${ln}`);
      }
      lines.push('');
    }

    // Detect structured bindings for current platform (web / android / others)
    const steps = entity.steps || [];
    const usedPages = new Map<string, UsedPage>();
    const stepCallLines: string[] = [];
    const catalog = await this.actionCatalog.getCatalog(platform);
    const returnedPageKeys = new Set<string>();
    const declaredVars = new Set<string>();
    const hasBindings = steps.some((s) => {
      if (!s.binding) return false;
      try {
        const parsed = JSON.parse(s.binding) as StepBindingV1;
        const resolved = this.actionCatalog.resolveBindingWithCatalog(
          catalog,
          parsed,
        );
        return !!resolved;
      } catch {
        return false;
      }
    });

    if (hasBindings) {
      for (const s of steps) {
        let binding: StepBindingV1 | null = null;
        if (s.binding) {
          try {
            binding = JSON.parse(s.binding) as StepBindingV1;
          } catch {
            binding = null;
          }
        }
        const resolved = binding
          ? this.actionCatalog.resolveBindingWithCatalog(catalog, binding)
          : null;
        if (!resolved) {
          // Fallback：对未绑定步骤保留注释
          stepCallLines.push(
            `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
          );
          if (s.data) {
            stepCallLines.push(
              `    //   Data / Precondition: ${s.data.replace(/\r?\n/g, ' ')}`,
            );
          }
          stepCallLines.push(
            `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
          );
          continue;
        }
        const { page, action } = resolved;
        const pageKey = page.key;
        if (!usedPages.has(pageKey)) {
          usedPages.set(pageKey, {
            className: page.className,
            varName: page.varName,
            module: (page as any).module ?? null,
          });
        }
        // 标记为已声明，避免后续 returnTarget 再用 let 重复声明（初始化会在文件头或前置步骤完成）
        declaredVars.add(page.varName);
        const rawReturnTarget = (action as any)?.returnTarget
          ? String((action as any).returnTarget).trim()
          : '';
        const returnTargetPage =
          rawReturnTarget &&
          catalog.pages.find(
            (p) =>
              p.className === rawReturnTarget ||
              p.key === rawReturnTarget ||
              p.varName === rawReturnTarget,
          );
        if (returnTargetPage) {
          returnedPageKeys.add(returnTargetPage.key);
        }
        const args =
          (binding?.args || [])
            .map((a) => `${a.value}`)
            .filter((v) => v.length > 0) || [];
        const argsCode = args.map((v) => JSON.stringify(v)).join(', ');
        const callExpr =
          argsCode.length > 0
            ? `${page.varName}.${action.method}(${argsCode})`
            : `${page.varName}.${action.method}()`;
        // 保留一行注释 + 一行真实调用，便于阅读
        stepCallLines.push(
          `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
        );
        if (s.data) {
          stepCallLines.push(
            `    //   Data / Precondition: ${s.data.replace(/\r?\n/g, ' ')}`,
          );
        }
        stepCallLines.push(
          `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
        );
        if (returnTargetPage) {
          const targetVar = returnTargetPage.varName;
          const assign = declaredVars.has(targetVar)
            ? `    ${targetVar} = await ${callExpr};`
            : `    let ${targetVar} = await ${callExpr};`;
          declaredVars.add(targetVar);
          stepCallLines.push(assign);
        } else {
          stepCallLines.push(`    await ${callExpr};`);
        }
        const rule: StepCheckRule | undefined =
          binding && typeof (binding as any).checkRule === 'object'
            ? ((binding as any).checkRule as StepCheckRule)
            : undefined;
        if (rule && rule.type) {
          const type = rule.type;
          if (type === 'element-visible' || type === 'element-hidden') {
            const fromRule = (rule.locator || '').toString().trim();
            const fromAction = (action as any).locator
              ? (action as any).locator.toString().trim()
              : '';
            const locator = fromRule || fromAction;
            if (locator) {
              const locatorLit = JSON.stringify(locator);
              const expectedText = (s.expected || '').toString().trim();
              const userMessage = expectedText
                ? expectedText.replace(/\r?\n/g, ' ')
                : '';
              const defaultMessage =
                type === 'element-visible'
                  ? `元素应出现：${locator}`
                  : `元素应消失：${locator}`;
              const description = userMessage || defaultMessage;
              stepCallLines.push('    {');
              stepCallLines.push(`      const driver: any = (tc as any).page;`);
              stepCallLines.push(`      let el: any = null;`);
              stepCallLines.push('      try {');
              stepCallLines.push(
                `        el = driver && typeof driver.$ === 'function' ? await driver.$(${locatorLit}) : null;`,
              );
              stepCallLines.push('      } catch (e) {');
              stepCallLines.push('        el = null;');
              stepCallLines.push('      }');
              if (type === 'element-visible') {
                stepCallLines.push(
                  `      tc.assertNotNull(el, ${JSON.stringify(description)});`,
                );
              } else {
                stepCallLines.push(
                  `      if (el) { throw new Error(${JSON.stringify(
                    description,
                  )} + '（实际仍然存在）'); }`,
                );
              }
              stepCallLines.push('    }');
            }
          } else if (type === 'url-contains' || type === 'url-equals') {
            const expectedUrl = (rule.expectedUrl || '').toString().trim();
            if (expectedUrl) {
              const expectedLit = JSON.stringify(expectedUrl);
              const mode = type === 'url-contains' ? '包含' : '等于';
              stepCallLines.push('    {');
              stepCallLines.push(`      const driver: any = (tc as any).page;`);
              stepCallLines.push(
                `      const url = driver && typeof driver.getUrl === 'function' ? await driver.getUrl() :`,
              );
              stepCallLines.push(
                `        driver && typeof driver.url === 'function' ? await driver.url() : '';`,
              );
              stepCallLines.push(
                type === 'url-contains'
                  ? `      const ok = typeof url === 'string' && url.includes(${expectedLit});`
                  : `      const ok = typeof url === 'string' && url === ${expectedLit};`,
              );
              stepCallLines.push(
                `      tc.assertEqual(true, ok, ${JSON.stringify(
                  `URL 检查：期望${mode} ${expectedUrl}`,
                )});`,
              );
              stepCallLines.push('    }');
            }
          }
        }
      }
    }

    // Imports
    const importCore = isApiPlatform
      ? "import { describe, it, expect, useTestCase } from 'core-lib';"
      : hasBindings
        ? "import { describe, it, useTestCase } from 'core-lib';"
        : "import { describe, it } from 'core-lib';";
    lines.push(importCore);
    if (hasBindings && usedPages.size > 0) {
      const byModule = new Map<string, Set<string>>();
      for (const { className, module } of usedPages.values()) {
        const mod =
          (module && module.trim()) || this.getModuleNameForPlatform(platform);
        if (!byModule.has(mod)) byModule.set(mod, new Set<string>());
        byModule.get(mod)!.add(className);
      }
      for (const [mod, classSet] of byModule.entries()) {
        const uniqueClassNames = Array.from(classSet.values());
        lines.push(`import { ${uniqueClassNames.join(', ')} } from '${mod}';`);
      }
    }
    lines.push('');

    const describeTitlePrefix =
      platform === 'gettr-android'
        ? '[android]'
        : platform === 'gettr-mobile-web'
          ? '[mobile-web]'
          : `[${platform}]`;
    const describeTitle = `${describeTitlePrefix} ${entity.code} ${entity.title}`;
    lines.push(`describe(${JSON.stringify(describeTitle)}, () => {`);
    if (isApiPlatform) {
      // -------- API 平台（gettr-api-livestream）：使用 useTestCase 但不启动浏览器 / Android，会通过 fetch 调用后端 API --------
      lines.push(
        `  const tc = useTestCase({`,
        `    module: '${moduleName}',`,
        `    browser: false,`,
        `    android: false,`,
        `    tags: ['api', '${moduleName}'],`,
        `  });`,
        '',
        '  type ApiTestConfig = {',
        '    baseUrl: string;',
        '    defaultHeaders?: Record<string, string>;',
        '    sampleLivePostId?: string;',
        '  };',
        '',
        '  function getApiTestConfig(): ApiTestConfig {',
        '    const anyGlobal = globalThis as any;',
        '    const baseCfg = (anyGlobal?.params?.apiTestConfig ?? {}) as Partial<ApiTestConfig>;',
        '    const envCfgRaw = (anyGlobal?.params?.envConfig ?? null) as any;',
        '    const envCfg =',
        '      envCfgRaw && typeof envCfgRaw === "object"',
        '        ? (envCfgRaw as Partial<ApiTestConfig>)',
        '        : ({} as Partial<ApiTestConfig>);',
        '    const merged: Partial<ApiTestConfig> = { ...baseCfg, ...envCfg };',
        '    if (!merged.baseUrl) {',
        "      throw new Error('apiTestConfig.baseUrl is not configured. 请在 Settings → Parameters → API Tests 中配置。');",
        '    }',
        '    return merged as ApiTestConfig;',
        '  }',
        '',
        '  async function apiRequest(path: string, init: RequestInit = {}) {',
        '    const { baseUrl, defaultHeaders } = getApiTestConfig();',
        "    const url = `${baseUrl.replace(/\\/$/, '')}${path}`;",
        '    const headers: Record<string, string> = {',
        '      ...(defaultHeaders || {}),',
        '      ...(init.headers as Record<string, string> | undefined || {}),',
        '    };',
        '    const res = await fetch(url, { ...init, headers });',
        '    return res;',
        '  }',
        '',
        '  async function apiPost(path: string, body?: any, init: RequestInit = {}) {',
        "    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined || {}) };",
        "    return apiRequest(path, { ...init, method: 'POST', headers, body: body == null ? undefined : JSON.stringify(body) });",
        '  }',
        '',
        "  it('should satisfy all defined steps', async () => {",
      );
      if (!entity.steps || entity.steps.length === 0) {
        lines.push(
          `    // TODO: 当前用例尚未从 CSV 或用例管理中定义具体步骤，请先在「用户场景」页面补充步骤。`,
          `    // 示例：`,
          `    // const res = await apiPost('/admin/live/start', { ... });`,
          `    // tc.assertEqual(200, res.status, '开播接口返回 200');`,
        );
      } else {
        lines.push(
          `    // 以下步骤由用例管理模块自动生成，已根据“数据”列中的 method/path/body 生成 API 调用骨架，请按需补充断言与请求体：`,
        );
        let apiStepIndex = 0;
        for (const s of entity.steps) {
          const step = { order: s.order, action: s.action, expected: s.expected, data: s.data } as any;
          const linesBuilt = buildApiStepLines(step, `res${++apiStepIndex}`);
          lines.push(...linesBuilt.map((ln) => (ln.startsWith('    ') ? ln : `    ${ln}`)));
        }
      }
      lines.push('  });');
    } else if (hasBindings) {
      let envConfigLines: string[] = [];
      if (envTemplateId && Number.isFinite(envTemplateId)) {
        const tpl = await this.envTemplateRepo.findOne({
          where: { id: envTemplateId as number },
        });
        if (tpl && tpl.enabled) {
          let parsed: any = {};
          try {
            parsed = JSON.parse(tpl.config || '{}');
          } catch {
            parsed = {};
          }
          const rawLines = JSON.stringify(parsed, null, 2).split('\n');
          let innerLines: string[];
          if (
            rawLines.length >= 2 &&
            rawLines[0].trim().startsWith('{') &&
            rawLines[rawLines.length - 1].trim().startsWith('}')
          ) {
            innerLines = rawLines.slice(1, -1);
          } else {
            innerLines = rawLines;
          }
          const json = innerLines.map((ln) => (ln ? `      ${ln}` : ln));
          lines.push(
            `  // Env template: ${tpl.name} (${tpl.key})`,
          );
          if (platform === 'gettr-android') {
            envConfigLines = [
              `  const tc = useTestCase({`,
              `    module: '${moduleName}',`,
              `    android: {`,
              ...json,
              `    },`,
              `    keepAppOpen: true,`,
              `    shareSession: true,`,
              `  });`,
              '',
            ];
          } else {
            envConfigLines = [
              `  const tc = useTestCase({`,
              `    module: '${moduleName}',`,
              `    browser: {`,
              ...json,
              `    },`,
              `  });`,
              '',
            ];
          }
        }
      }
      if (envConfigLines.length === 0) {
        if (platform === 'gettr-android') {
          envConfigLines = [
            `  const tc = useTestCase({`,
            `    module: '${moduleName}',`,
            `    android: {`,
            `      // TODO: 根据实际设备/环境配置以下参数：`,
            `      // deviceName: 'my-device',`,
            `      // udid: 'YOUR_DEVICE_UDID',`,
            `      // appPackage: 'com.gettr.gettr',`,
            `      // appActivity: '.MainActivity',`,
            `      // 或使用 apk 安装方式（示例）：`,
            `      // apk: '1.xx.x_xxx.apk',`,
            `    },`,
            `    keepAppOpen: true,`,
            `    shareSession: true,`,
            `  });`,
            '',
          ];
        } else {
          envConfigLines = [
            `  const tc = useTestCase({`,
            `    module: '${moduleName}',`,
            `    browser: {`,
            `      headless: false,`,
            `      debug: true,`,
            `      // TODO: 根据环境调整域名，例如：https://stg.gettr.com`,
            `      // domain: 'https://stg.gettr.com',`,
            `    },`,
            `  });`,
            '',
          ];
        }
      }
      lines.push(...envConfigLines);
      if (usedPages.size > 0) {
        for (const { className, varName } of usedPages.values()) {
          lines.push(
            `  const ${varName} = new ${className}(tc as any);`,
          );
        }
        lines.push('');
      }
      lines.push(
        `  it('should satisfy all defined steps', async () => {`,
      );
      if (stepCallLines.length === 0) {
        lines.push(
          `    // TODO: 当前用例尚未定义具体步骤，请在用例管理页面补充后再完善此处实现。`,
        );
      } else {
        const primaryLib = this.getModuleNameForPlatform(platform);
        lines.push(
          `    // 以下步骤由用例管理模块自动生成，对应 ${primaryLib} 中的页面与方法：`,
        );
        lines.push(...stepCallLines);
      }
      lines.push('  });');
    } else {
      lines.push(
        `  it('should satisfy all defined steps', async () => {`,
      );
      if (!entity.steps || entity.steps.length === 0) {
        lines.push(
          `    // TODO: 当前用例尚未定义具体步骤，请在用例管理页面补充后再完善此处实现。`,
        );
      } else {
        lines.push(
          `    // 以下步骤由用例管理模块自动生成，请根据需要替换为真实 App / API 操作：`,
        );
        for (const s of entity.steps) {
          lines.push(
            `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
          );
          if (s.data) {
            lines.push(
              `    //   Data / Precondition: ${s.data.replace(
                /\r?\n/g,
                ' ',
              )}`,
            );
          }
          lines.push(
            `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
          );
        }
        lines.push('');
        lines.push(
          `    // 示例：`,
          `    // const app = await launchAppWithTestAccount(...);`,
          `    // await app.goLive();`,
          `    // await app.expectLiveBadgeVisible();`,
        );
      }
      lines.push('  });');
    }
    lines.push('});');
    lines.push('');

    await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');

    entity.hasCode = true;
    entity.generatedFilePath = relPath;
    entity.generatedAt = new Date();
    entity.status = 'code_generated';
    await this.caseRepo.save(entity);

    return { filePath: relPath };
  }


  async generateCodeForSuite(
    suiteId: number,
    username: string,
    envTemplateId?: number | null,
  ) {
    const suite = await this.suiteRepo.findOne({
      where: { id: suiteId },
      relations: ['cases', 'cases.steps'],
    });
    if (!suite) {
      throw new NotFoundException(`Suite ${suiteId} not found`);
    }
    const cases = (suite.cases || [])
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code));
    if (!cases.length) {
      throw new NotFoundException(`Suite ${suite.name} 尚未包含任何用例`);
    }

    const platform = this.normalizePlatform(
      suite.platform || cases[0]?.platform || 'gettr-web',
    );
    const isApiPlatform = platform.includes('-api-');
    const moduleName = this.sanitizeName(
      suite.module || cases[0]?.module || 'live-stream',
    );
    const safeUser = this.sanitizeName(username || 'default');
    const root = path.resolve(
      process.cwd(),
      'workspace',
      'users',
      safeUser,
      'suites',
      platform,
      moduleName,
    );
    await fs.promises.mkdir(root, { recursive: true });

    const safeSuiteName = this.sanitizeName(suite.name || `suite-${suiteId}`);
    const filePath = path.join(root, `${safeSuiteName}.ts`);
    const relPath = path.relative(process.cwd(), filePath);

    const sharedPreSteps = this.parseSharedPreSteps(suite.sharedPreStepsJson);

    const lines: string[] = [
      '// Auto-generated live stream suite',
      `// Suite: ${suite.name}`,
      `// Generated at: ${new Date().toISOString()}`,
      '',
    ];

    const catalog = await this.actionCatalog.getCatalog(platform);
    type UsedPage = { className: string; varName: string; module?: string | null };
    const usedPages = new Map<string, UsedPage>();
    const stepLinesByCase = new Map<number, string[]>();
    let hasBindings = false;

    if (!isApiPlatform) {
      for (const sc of cases) {
        const steps = (sc.steps || []).slice().sort((a, b) => a.order - b.order);
        const stepLines: string[] = [];
        for (const s of steps) {
          let binding: StepBindingV1 | null = null;
          if (s.binding) {
            try {
              binding = JSON.parse(s.binding) as StepBindingV1;
            } catch {
              binding = null;
            }
          }
          const resolved = binding
            ? this.actionCatalog.resolveBindingWithCatalog(catalog, binding)
            : null;
          if (!resolved) {
            stepLines.push(
              `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
            );
            if (s.data) {
              stepLines.push(
                `    //   Data / Precondition: ${s.data.replace(
                  /\r?\n/g,
                  ' ',
                )}`,
              );
            }
            stepLines.push(
              `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
            );
            continue;
          }
          hasBindings = true;
          const { page, action } = resolved;
          const pageKey = page.key;
          if (!usedPages.has(pageKey)) {
            usedPages.set(pageKey, {
              className: page.className,
              varName: page.varName,
              module: (page as any).module ?? null,
            });
          }
          const args =
            (binding?.args || [])
              .map((a) => `${a.value}`)
              .filter((v) => v.length > 0) || [];
          const argsCode = args.map((v) => JSON.stringify(v)).join(', ');
          const call =
            argsCode.length > 0
              ? `    await ${page.varName}.${action.method}(${argsCode});`
              : `    await ${page.varName}.${action.method}();`;
          stepLines.push(
            `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
          );
          if (s.data) {
            stepLines.push(
              `    //   Data / Precondition: ${s.data.replace(
                /\r?\n/g,
                ' ',
              )}`,
            );
          }
          stepLines.push(
            `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
          );
          stepLines.push(call);
          const rule: StepCheckRule | undefined =
            binding && typeof (binding as any).checkRule === 'object'
              ? ((binding as any).checkRule as StepCheckRule)
              : undefined;
          if (rule && rule.type) {
            if (rule.type === 'element-visible' || rule.type === 'element-hidden') {
              const fromRule = (rule.locator || '').toString().trim();
              const fromAction = (action as any).locator
                ? (action as any).locator.toString().trim()
                : '';
              const locator = fromRule || fromAction;
              if (locator) {
                const locatorLit = JSON.stringify(locator);
                const expectedText = (s.expected || '').toString().trim();
                const userMessage = expectedText
                  ? expectedText.replace(/\r?\n/g, ' ')
                  : '';
                const defaultMessage =
                  rule.type === 'element-visible'
                    ? `元素应出现：${locator}`
                    : `元素应消失：${locator}`;
                const description = userMessage || defaultMessage;
                stepLines.push('    {');
                stepLines.push(`      const driver: any = (tc as any).page;`);
                stepLines.push(`      let el: any = null;`);
                stepLines.push('      try {');
                stepLines.push(
                  `        el = driver && typeof driver.$ === 'function' ? await driver.$(${locatorLit}) : null;`,
                );
                stepLines.push('      } catch (e) {');
                stepLines.push('        el = null;');
                stepLines.push('      }');
                if (rule.type === 'element-visible') {
                  stepLines.push(
                    `      tc.assertNotNull(el, ${JSON.stringify(description)});`,
                  );
                } else {
                  stepLines.push(
                    `      if (el) { throw new Error(${JSON.stringify(
                      description,
                    )} + '（实际仍然存在）'); }`,
                  );
                }
                stepLines.push('    }');
              }
            } else if (rule.type === 'url-contains' || rule.type === 'url-equals') {
              const expectedUrl = (rule.expectedUrl || '').toString().trim();
              if (expectedUrl) {
                const expectedLit = JSON.stringify(expectedUrl);
                const mode =
                  rule.type === 'url-contains' ? '包含' : '等于';
                stepLines.push('    {');
                stepLines.push(`      const driver: any = (tc as any).page;`);
                stepLines.push(
                  `      const url = driver && typeof driver.getUrl === 'function' ? await driver.getUrl() :`,
                );
                stepLines.push(
                  `        driver && typeof driver.url === 'function' ? await driver.url() : '';`,
                );
                stepLines.push(
                  rule.type === 'url-contains'
                    ? `      const ok = typeof url === 'string' && url.includes(${expectedLit});`
                    : `      const ok = typeof url === 'string' && url === ${expectedLit};`,
                );
                stepLines.push(
                  `      tc.assertEqual(true, ok, ${JSON.stringify(
                    `URL 检查：期望${mode} ${expectedUrl}`,
                  )});`,
                );
                stepLines.push('    }');
              }
            }
          }
        }
        stepLinesByCase.set(sc.id, stepLines);
      }
    }

    const importCore = isApiPlatform
      ? "import { describe, it, expect, useTestCase } from 'core-lib';"
      : "import { describe, it, useTestCase } from 'core-lib';";
    lines.push(importCore);
    if (!isApiPlatform && hasBindings && usedPages.size > 0) {
      const byModule = new Map<string, Set<string>>();
      for (const { className, module } of usedPages.values()) {
        const mod =
          (module && module.trim()) || this.getModuleNameForPlatform(platform);
        if (!byModule.has(mod)) byModule.set(mod, new Set<string>());
        byModule.get(mod)!.add(className);
      }
      for (const [mod, classSet] of byModule.entries()) {
        const uniqueClassNames = Array.from(classSet.values());
        lines.push(
          `import { ${uniqueClassNames.join(', ')} } from '${mod}';`,
        );
      }
    }
    lines.push('');

    const describeTitlePrefix =
      platform === 'gettr-android'
        ? '[android]'
        : platform === 'gettr-mobile-web'
        ? '[mobile-web]'
        : `[${platform}]`;
    const describeTitle = `${describeTitlePrefix} Suite: ${suite.name}`;
    lines.push(`describe(${JSON.stringify(describeTitle)}, () => {`);

    const envConfigLines: string[] = [];
    const tplLines: string[] = [];
    if (envTemplateId && Number.isFinite(envTemplateId)) {
      const tpl = await this.envTemplateRepo.findOne({
        where: { id: envTemplateId as number },
      });
      if (tpl && tpl.enabled) {
        let parsed: any = {};
        try {
          parsed = JSON.parse(tpl.config || '{}');
        } catch {
          parsed = {};
        }
        const rawLines = JSON.stringify(parsed, null, 2).split('\n');
        let innerLines: string[];
        if (
          rawLines.length >= 2 &&
          rawLines[0].trim().startsWith('{') &&
          rawLines[rawLines.length - 1].trim().startsWith('}')
        ) {
          innerLines = rawLines.slice(1, -1);
        } else {
          innerLines = rawLines;
        }
        const json = innerLines.map((ln) => (ln ? `      ${ln}` : ln));
        tplLines.push(`  // Env template: ${tpl.name} (${tpl.key})`);
        if (platform === 'gettr-android') {
          envConfigLines.push(
            `  const tc = useTestCase({`,
            `    module: '${moduleName}',`,
            `    android: {`,
            ...json,
            `    },`,
            `    keepAppOpen: true,`,
            `    shareSession: true,`,
            `  });`,
            '',
          );
        } else {
          envConfigLines.push(
            `  const tc = useTestCase({`,
            `    module: '${moduleName}',`,
            `    browser: {`,
            ...json,
            `    },`,
            `  });`,
            '',
          );
        }
      }
    }
    if (!envConfigLines.length) {
      if (platform === 'gettr-android') {
        envConfigLines.push(
          `  const tc = useTestCase({`,
          `    module: '${moduleName}',`,
          `    android: {`,
          `      // TODO: 根据实际设备/环境配置以下参数：`,
          `      // deviceName: 'my-device',`,
          `      // udid: 'YOUR_DEVICE_UDID',`,
          `      // appPackage: 'com.gettr.gettr',`,
          `      // appActivity: '.MainActivity',`,
          `    },`,
          `    keepAppOpen: true,`,
          `    shareSession: true,`,
          `  });`,
          '',
        );
      } else {
        envConfigLines.push(
          `  const tc = useTestCase({`,
          `    module: '${moduleName}',`,
          `    browser: {`,
          `      headless: false,`,
          `      debug: true,`,
          `    },`,
          `  });`,
          '',
        );
      }
    }
    lines.push(...tplLines);
    lines.push(...envConfigLines);

    if (!isApiPlatform && hasBindings && usedPages.size > 0) {
      for (const { className, varName } of usedPages.values()) {
        lines.push(`  const ${varName} = new ${className}(tc as any);`);
      }
      lines.push('');
    }

    lines.push(
      `  async function runSuitePreSteps() {`,
      `    // 套件级前置步骤（在「用户场景」页面的套件中维护，仅需实现一次即可复用）：`,
    );
    if (sharedPreSteps.length) {
      sharedPreSteps.forEach((txt, idx) => {
        lines.push(`    // ${idx + 1}. ${txt}`);
      });
    } else {
      lines.push(`    // （尚未填写，可在套件中补充前置步骤说明）`);
    }
    lines.push(
      `    // TODO: 根据上面的描述实现实际前置操作，避免在各个用例中重复维护。`,
      `  }`,
      '',
    );

    if (isApiPlatform) {
      lines.push(
        '  type ApiTestConfig = {',
        '    baseUrl: string;',
        '    defaultHeaders?: Record<string, string>;',
        '    sampleLivePostId?: string;',
        '  };',
        '',
        '  function getApiTestConfig(): ApiTestConfig {',
        '    const anyGlobal = globalThis as any;',
        '    const baseCfg = (anyGlobal?.params?.apiTestConfig ?? {}) as Partial<ApiTestConfig>;',
        '    const envCfgRaw = (anyGlobal?.params?.envConfig ?? null) as any;',
        '    const envCfg =',
        '      envCfgRaw && typeof envCfgRaw === "object"',
        '        ? (envCfgRaw as Partial<ApiTestConfig>)',
        '        : ({} as Partial<ApiTestConfig>);',
        '    const merged: Partial<ApiTestConfig> = { ...baseCfg, ...envCfg };',
        "    if (!merged.baseUrl) {",
        "      throw new Error('apiTestConfig.baseUrl is not configured. 请在 Settings → Parameters → API Tests 中配置。');",
        '    }',
        '    return merged as ApiTestConfig;',
        '  }',
        '',
        '  async function apiRequest(path: string, init: RequestInit = {}) {',
        '    const { baseUrl, defaultHeaders } = getApiTestConfig();',
        "    const url = `${baseUrl.replace(/\\/$/, '')}${path}`;",
        '    const headers: Record<string, string> = {',
        '      ...(defaultHeaders || {}),',
        "      ...(init.headers as Record<string, string> | undefined || {}),",
        '    };',
        '    const res = await fetch(url, { ...init, headers });',
        '    return res;',
        '  }',
        '',
        '  async function apiPost(path: string, body?: any, init: RequestInit = {}) {',
        "    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined || {}) };",
        "    return apiRequest(path, { ...init, method: 'POST', headers, body: body == null ? undefined : JSON.stringify(body) });",
        '  }',
        '',
      );
    }

    for (const sc of cases) {
      const steps = (sc.steps || []).slice().sort((a, b) => a.order - b.order);
      const caseTitle = `${sc.code} ${sc.title}`;
      lines.push(`  it(${JSON.stringify(caseTitle)}, async () => {`);
      lines.push('    await runSuitePreSteps();');
      if (isApiPlatform) {
        if (!steps.length) {
          lines.push(
            `    // TODO: 当前用例尚未定义具体步骤，请先在用例管理页面补充。`,
          );
        } else {
          lines.push(
            `    // 以下步骤由用例管理模块生成，请根据“数据”列中的 method/path/body 补充 API 调用与断言：`,
          );
          let apiStepIndex = 0;
          for (const s of steps) {
            const step = { order: s.order, action: s.action, expected: s.expected, data: s.data } as any;
            const built = buildApiStepLines(step, `res${++apiStepIndex}`);
            lines.push(...built.map((ln) => (ln.startsWith('    ') ? ln : `    ${ln}`)));
          }
        }
      } else {
        const stepLines = stepLinesByCase.get(sc.id) || [];
        if (!stepLines.length) {
          lines.push(
            `    // TODO: 当前用例尚未定义具体步骤，请在用例管理页面补充后完善此处实现。`,
          );
        } else {
          lines.push(
            `    // 以下步骤由用例管理模块自动生成，已复用套件级前置步骤：`,
          );
          lines.push(...stepLines);
        }
      }
      lines.push('  });');
      lines.push('');
    }

    lines.push('});');
    lines.push('');

    await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');

    // 标记套件内的用例已生成代码（指向同一个套件文件）
    for (const sc of cases) {
      sc.hasCode = true;
      sc.generatedFilePath = relPath;
      sc.generatedAt = new Date();
      sc.status = 'code_generated';
      await this.caseRepo.save(sc);
    }

    return { filePath: relPath };
  }

}
