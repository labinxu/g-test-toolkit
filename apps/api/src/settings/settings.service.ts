import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { Setting } from './setting.entity';
import { ApiTestBaseUrl } from '../api-tests/api-test-base-url.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
    @InjectRepository(ApiTestBaseUrl)
    private readonly apiTestBaseUrls: Repository<ApiTestBaseUrl>,
  ) {}

  private getMasterKey(): Buffer | null {
    const raw = process.env.CONFIG_ENCRYPTION_KEY || '';
    if (!raw) return null;
    // normalize to 32 bytes
    const buf = Buffer.from(raw.padEnd(32, '0').slice(0, 32));
    return buf.length === 32 ? buf : null;
  }

  private encrypt(plain: string): string {
    const key = this.getMasterKey();
    if (!key) return plain; // not encrypted
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([
      cipher.update(Buffer.from(plain, 'utf8')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from('1'), iv, tag, enc]).toString('base64');
  }

  private decrypt(data: string, encrypted: boolean): string {
    if (!encrypted) return data;
    const key = this.getMasterKey();
    if (!key) return data; // cannot decrypt without key
    const buf = Buffer.from(data, 'base64');
    // layout: [1-byte ver][12-byte iv][16-byte tag][...cipher]
    const ver = buf.subarray(0, 1);
    if (ver[0] !== 0x31) return data; // unknown version, return raw
    const iv = buf.subarray(1, 13);
    const tag = buf.subarray(13, 29);
    const enc = buf.subarray(29);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }

  async get(key: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { key } });
    if (!row) return null;
    return this.decrypt(row.value || '', !!row.encrypted);
  }

  async set(
    key: string,
    value: string | null,
    opts?: { encrypt?: boolean },
  ): Promise<void> {
    const encrypted = !!opts?.encrypt && !!this.getMasterKey();
    const toStore =
      value == null ? null : encrypted ? this.encrypt(value) : value;
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.value = toStore;
      existing.encrypted = encrypted;
      await this.repo.save(existing);
    } else {
      const row = this.repo.create({ key, value: toStore, encrypted });
      await this.repo.save(row);
    }
  }

  private makeKey(base: string, userId?: number | null) {
    if (userId == null) return base;
    return `user:${userId}:${base}`;
  }

  private async getValue(
    base: string,
    userId?: number | null,
  ): Promise<string | null> {
    if (userId != null) {
      const scoped = await this.get(this.makeKey(base, userId));
      if (scoped != null) return scoped;
    }
    return userId == null ? this.get(base) : null;
  }

  async getAiConfig(userId?: number): Promise<{
    provider: string;
    model: string;
    baseUrl: string;
    apiKey: string | null;
    timeoutMs: number | null;
    maxTokens: number | null;
  }> {
    const provider = (await this.getValue('ai.provider', userId)) || '';
    const model = (await this.getValue('ai.model', userId)) || '';
    const baseUrl = (await this.getValue('ai.baseUrl', userId)) || '';
    const apiKey = (await this.getValue('ai.apiKey', userId)) || null;
    const timeoutRaw = await this.getValue('ai.timeoutMs', userId);
    let timeoutMs: number | null = null;
    if (timeoutRaw != null) {
      const parsed = parseInt(timeoutRaw, 10);
      if (Number.isFinite(parsed)) timeoutMs = parsed;
    }
    const maxTokensRaw = await this.getValue('ai.maxTokens', userId);
    const maxTokens = maxTokensRaw ? parseInt(maxTokensRaw, 10) || null : null;
    return { provider, model, baseUrl, apiKey, timeoutMs, maxTokens };
  }

  async setAiConfig(
    input: {
      provider?: string;
      model?: string;
      baseUrl?: string;
      apiKey?: string | null;
      clearKey?: boolean;
      timeoutMs?: number | null;
      maxTokens?: number | null;
    },
    userId?: number,
  ): Promise<void> {
    // If API key provided while encryption is required but no master key configured, reject
    const encryptionRequired =
      (process.env.REQUIRE_CONFIG_ENCRYPTION || '') === '1';
    const hasMaster = !!this.getMasterKey();
    if (
      !input?.clearKey &&
      typeof input?.apiKey === 'string' &&
      input.apiKey !== '' &&
      encryptionRequired &&
      !hasMaster
    ) {
      throw new Error(
        'Saving API key requires CONFIG_ENCRYPTION_KEY to be set',
      );
    }
    const scopedKey = (suffix: string) =>
      this.makeKey(`ai.${suffix}`, userId ?? null);

    if (input.provider != null)
      await this.set(scopedKey('provider'), input.provider);
    if (input.model != null) await this.set(scopedKey('model'), input.model);
    if (input.baseUrl != null)
      await this.set(scopedKey('baseUrl'), input.baseUrl);
    if (input.clearKey)
      await this.set(scopedKey('apiKey'), null, { encrypt: true });
    else if (input.apiKey != null && input.apiKey !== '')
      await this.set(scopedKey('apiKey'), input.apiKey, { encrypt: true });
    if (input.timeoutMs !== undefined) {
      if (input.timeoutMs == null) {
        await this.set(scopedKey('timeoutMs'), null);
      } else {
        const raw = Math.floor(input.timeoutMs);
        if (raw <= 0) {
          await this.set(scopedKey('timeoutMs'), '0');
        } else {
          const clamped = Math.max(1000, Math.min(600000, raw));
          await this.set(scopedKey('timeoutMs'), String(clamped));
        }
      }
    }
    if (input.maxTokens !== undefined) {
      if (input.maxTokens == null) {
        await this.set(scopedKey('maxTokens'), null);
      } else {
        const clamped = Math.max(
          64,
          Math.min(512000, Math.floor(input.maxTokens)),
        );
        await this.set(scopedKey('maxTokens'), String(clamped));
      }
    }
  }

  async getApiTestsConfig(
    userId?: number,
  ): Promise<{
    baseUrl: string;
    defaultHeaders: Record<string, string>;
    sampleLivePostId: string | null;
  }> {
    const baseUrl = (await this.getValue('apiTests.baseUrl', userId)) || '';
    const headersRaw = await this.getValue('apiTests.headersJson', userId);
    const sampleLivePostId =
      (await this.getValue('apiTests.sampleLivePostId', userId)) || null;
    let defaultHeaders: Record<string, string> = {};
    if (headersRaw) {
      try {
        const parsed = JSON.parse(headersRaw);
        if (parsed && typeof parsed === 'object') {
          const entries = Object.entries(parsed) as Array<[string, unknown]>;
          defaultHeaders = {};
          for (const [k, v] of entries) {
            if (typeof k === 'string' && typeof v === 'string') {
              defaultHeaders[k] = v;
            }
          }
        }
      } catch {
        // ignore malformed JSON, fallback to empty headers
      }
    }
    return { baseUrl, defaultHeaders, sampleLivePostId };
  }

  async setApiTestsConfig(
    input: {
      baseUrl?: string;
      defaultHeaders?: Record<string, string> | null;
      sampleLivePostId?: string | null;
    },
    userId?: number,
  ): Promise<void> {
    const scopedKey = (suffix: string) =>
      this.makeKey(`apiTests.${suffix}`, userId ?? null);

    if (input.baseUrl != null) {
      await this.set(scopedKey('baseUrl'), input.baseUrl);
    }

    if (input.defaultHeaders !== undefined) {
      if (input.defaultHeaders === null) {
        await this.set(scopedKey('headersJson'), null);
      } else {
        const serialisable: Record<string, string> = {};
        for (const [k, v] of Object.entries(input.defaultHeaders)) {
          if (typeof k === 'string' && typeof v === 'string') {
            serialisable[k] = v;
          }
        }
        const json =
          Object.keys(serialisable).length > 0
            ? JSON.stringify(serialisable)
            : '';
        await this.set(scopedKey('headersJson'), json || null);
      }
    }

    if (input.sampleLivePostId !== undefined) {
      const value =
        input.sampleLivePostId == null || input.sampleLivePostId === ''
          ? null
          : input.sampleLivePostId;
      await this.set(scopedKey('sampleLivePostId'), value);
    }
  }

  async getApiModuleEnvs(
    module: string,
    userId?: number,
  ): Promise<{
    currentEnv: string | null;
    envs: Array<{
      name: string;
      label?: string;
      baseUrl: string;
      headers?: Record<string, string>;
    }>;
    endpointHeaders?: Record<
      string,
      Record<string, Record<string, string>>
    >;
    endpointBaseUrls?: Record<string, Record<string, string>>;
  }> {
    const safeModule = (module || '').trim().toLowerCase() || 'default';
    const baseKey = `apiTests.modules.${safeModule}`;
    const envsRaw = await this.getValue(`${baseKey}.envs`, userId);
    const currentRaw = await this.getValue(`${baseKey}.currentEnv`, userId);
    const endpointHeadersRaw = await this.getValue(
      `${baseKey}.endpointHeadersJson`,
      userId,
    );
    const endpointBaseUrlsRaw = await this.getValue(
      `${baseKey}.endpointBaseUrlsJson`,
      userId,
    );

    let envs: Array<{
      name: string;
      label?: string;
      baseUrl: string;
      headers?: Record<string, string>;
    }> = [];

    if (envsRaw) {
      try {
        const parsed = JSON.parse(envsRaw);
        if (Array.isArray(parsed)) {
          const mapped = parsed
            .map((item) => {
              const name =
                typeof item?.name === 'string'
                  ? item.name.trim()
                  : '';
              const label =
                typeof item?.label === 'string'
                  ? item.label
                  : undefined;
              const baseUrl =
                typeof item?.baseUrl === 'string'
                  ? item.baseUrl.trim()
                  : '';
              const headers: Record<string, string> = {};
              if (item?.headers && typeof item.headers === 'object') {
                for (const [k, v] of Object.entries(
                  item.headers as Record<string, unknown>,
                )) {
                  if (typeof k === 'string' && typeof v === 'string') {
                    headers[k] = v;
                  }
                }
              }
              if (!name || !baseUrl) return null;
              const env = {
                name,
                label,
                baseUrl,
                headers: Object.keys(headers).length ? headers : undefined,
              };
              return env;
            })
            .filter((x) => !!x) as Array<{
              name: string;
              label?: string;
              baseUrl: string;
              headers?: Record<string, string>;
            }>;
          envs = mapped;
        }
      } catch {
        envs = [];
      }
    }

    const currentEnv =
      typeof currentRaw === 'string' && currentRaw.trim()
        ? currentRaw.trim()
        : envs[0]?.name ?? null;

    let endpointHeaders:
      | Record<string, Record<string, Record<string, string>>>
      | undefined;
    if (endpointHeadersRaw) {
      try {
        const parsed = JSON.parse(endpointHeadersRaw);
        if (parsed && typeof parsed === 'object') {
          endpointHeaders = {};
          for (const [envName, byEndpoint] of Object.entries(
            parsed as Record<
              string,
              Record<string, Record<string, unknown>>
            >,
          )) {
            if (typeof envName !== 'string') continue;
            endpointHeaders[envName] = {};
            for (const [endpointId, headersObj] of Object.entries(
              byEndpoint || {},
            )) {
              if (typeof endpointId !== 'string') continue;
              const h: Record<string, string> = {};
              if (headersObj && typeof headersObj === 'object') {
                for (const [k, v] of Object.entries(headersObj)) {
                  if (typeof k === 'string' && typeof v === 'string') {
                    h[k] = v;
                  }
                }
              }
              if (Object.keys(h).length > 0) {
                endpointHeaders[envName][endpointId] = h;
              }
            }
            if (
              Object.keys(endpointHeaders[envName] || {}).length === 0
            ) {
              delete endpointHeaders[envName];
            }
          }
          if (Object.keys(endpointHeaders).length === 0) {
            endpointHeaders = undefined;
          }
        }
      } catch {
        endpointHeaders = undefined;
      }
    }

    let endpointBaseUrls: Record<string, Record<string, string>> | undefined;
    if (endpointBaseUrlsRaw) {
      try {
        const parsed = JSON.parse(endpointBaseUrlsRaw);
        if (parsed && typeof parsed === 'object') {
          endpointBaseUrls = {};
          for (const [envName, byEndpoint] of Object.entries(
            parsed as Record<string, Record<string, unknown>>,
          )) {
            if (typeof envName !== 'string') continue;
            const envKey = envName.trim();
            if (!envKey) continue;
            for (const [endpointId, urlVal] of Object.entries(
              byEndpoint || {},
            )) {
              if (typeof endpointId !== 'string') continue;
              if (typeof urlVal !== 'string') continue;
              const trimmedUrl = urlVal.trim();
              if (!trimmedUrl) continue;
              if (!endpointBaseUrls[envKey]) endpointBaseUrls[envKey] = {};
              endpointBaseUrls[envKey][endpointId.trim()] = trimmedUrl;
            }
          }
          if (Object.keys(endpointBaseUrls).length === 0) {
            endpointBaseUrls = undefined;
          }
        }
      } catch {
        endpointBaseUrls = undefined;
      }
    }

    return { currentEnv, envs, endpointHeaders, endpointBaseUrls };
  }

  async setApiModuleEnvs(
    module: string,
    input: {
      currentEnv?: string | null;
      envs?: Array<{
        name: string;
        label?: string;
        baseUrl: string;
        headers?: Record<string, string>;
      }>;
      endpointHeaders?: Record<
        string,
        Record<string, Record<string, string>>
      >;
      endpointBaseUrls?: Record<string, Record<string, string>>;
    },
    userId?: number,
  ): Promise<void> {
    const safeModule = (module || '').trim().toLowerCase() || 'default';
    const baseKey = `apiTests.modules.${safeModule}`;
    const scopedKey = (suffix: string) =>
      this.makeKey(`${baseKey}.${suffix}`, userId ?? null);

    if (input.envs) {
      const serialisable: Array<{
        name: string;
        label?: string;
        baseUrl: string;
        headers?: Record<string, string>;
      }> = [];
      for (const item of input.envs) {
        if (!item) continue;
        const name =
          typeof item.name === 'string' ? item.name.trim() : '';
        const baseUrl =
          typeof item.baseUrl === 'string'
            ? item.baseUrl.trim()
            : '';
        if (!name || !baseUrl) continue;
        const label =
          typeof item.label === 'string'
            ? item.label
            : undefined;
        const headers: Record<string, string> = {};
        if (item.headers && typeof item.headers === 'object') {
          for (const [k, v] of Object.entries(item.headers)) {
            if (typeof k === 'string' && typeof v === 'string') {
              headers[k] = v;
            }
          }
        }
        serialisable.push({
          name,
          label,
          baseUrl,
          headers: Object.keys(headers).length ? headers : undefined,
        });
      }
      const json =
        serialisable.length > 0 ? JSON.stringify(serialisable) : '';
      await this.set(scopedKey('envs'), json || null);
    }

    if (input.currentEnv !== undefined) {
      const v =
        input.currentEnv == null || input.currentEnv === ''
          ? null
          : String(input.currentEnv);
      await this.set(scopedKey('currentEnv'), v);
    }

    if (input.endpointHeaders !== undefined) {
      const cleaned: Record<
        string,
        Record<string, Record<string, string>>
      > = {};
      for (const [envName, byEndpoint] of Object.entries(
        input.endpointHeaders || {},
      )) {
        if (typeof envName !== 'string' || !envName.trim()) continue;
        const envKey = envName.trim();
        for (const [endpointId, headers] of Object.entries(
          byEndpoint || {},
        )) {
          if (typeof endpointId !== 'string' || !endpointId.trim())
            continue;
          const h: Record<string, string> = {};
          if (headers && typeof headers === 'object') {
            for (const [k, v] of Object.entries(headers)) {
              if (typeof k === 'string' && typeof v === 'string') {
                h[k] = v;
              }
            }
          }
          if (Object.keys(h).length > 0) {
            if (!cleaned[envKey]) cleaned[envKey] = {};
            cleaned[envKey][endpointId.trim()] = h;
          }
        }
      }
      const json =
        Object.keys(cleaned).length > 0
          ? JSON.stringify(cleaned)
          : '';
      await this.set(
        scopedKey('endpointHeadersJson'),
        json || null,
      );
    }

    if (input.endpointBaseUrls !== undefined) {
      const cleaned: Record<string, Record<string, string>> = {};
      for (const [envName, byEndpoint] of Object.entries(
        input.endpointBaseUrls || {},
      )) {
        if (typeof envName !== 'string' || !envName.trim()) continue;
        const envKey = envName.trim();
        for (const [endpointId, urlVal] of Object.entries(byEndpoint || {})) {
          if (typeof endpointId !== 'string' || !endpointId.trim()) continue;
          if (typeof urlVal !== 'string') continue;
          const trimmedUrl = urlVal.trim();
          if (!trimmedUrl) continue;
          if (!cleaned[envKey]) cleaned[envKey] = {};
          cleaned[envKey][endpointId.trim()] = trimmedUrl;
        }
      }
      const json =
        Object.keys(cleaned).length > 0
          ? JSON.stringify(cleaned)
          : '';
      await this.set(
        scopedKey('endpointBaseUrlsJson'),
        json || null,
      );
    }
  }

  async recordApiTestBaseUrl(
    module: string,
    url: string,
    userId: number,
  ): Promise<void> {
    const safeModule = (module || '').trim().toLowerCase() || 'default';
    const trimmedUrl = (url || '').trim();
    if (!trimmedUrl || !userId) return;

    const existing = await this.apiTestBaseUrls.findOne({
      where: { userId, module: safeModule, url: trimmedUrl },
    });
    const now = new Date();
    if (existing) {
      existing.usageCount = (existing.usageCount || 0) + 1;
      existing.lastUsedAt = now;
      await this.apiTestBaseUrls.save(existing);
    } else {
      const row = this.apiTestBaseUrls.create({
        userId,
        module: safeModule,
        url: trimmedUrl,
        usageCount: 1,
        createdAt: now,
        lastUsedAt: now,
      });
      await this.apiTestBaseUrls.save(row);
    }
  }

  async getApiTestBaseUrls(
    module: string,
    userId: number,
    limit = 20,
  ): Promise<
    Array<{
      url: string;
      label: string | null;
      usageCount: number;
      lastUsedAt: Date;
    }>
  > {
    const safeModule = (module || '').trim().toLowerCase() || 'default';
    if (!userId) return [];
    const rows = await this.apiTestBaseUrls.find({
      where: { userId, module: safeModule },
      order: { lastUsedAt: 'DESC' },
      take: limit,
    });
    return rows.map((r) => ({
      url: r.url,
      label: r.label ?? null,
      usageCount: r.usageCount ?? 0,
      lastUsedAt: r.lastUsedAt,
    }));
  }

  async getApiTestEndpointConfigs(
    module: string,
    userId: number,
  ): Promise<{
    byEndpoint: Record<
      string,
      { baseUrl?: string; headers?: Record<string, string> }
    >;
    baseUrlOptions: string[];
  }> {
    const safeModule = (module || '').trim().toLowerCase() || 'default';
    if (!userId) {
      return { byEndpoint: {}, baseUrlOptions: [] };
    }
    const rows = await this.apiTestBaseUrls.find({
      where: { userId, module: safeModule },
      order: { lastUsedAt: 'DESC' },
    });
    const byEndpoint: Record<
      string,
      { baseUrl?: string; headers?: Record<string, string> }
    > = {};
    const baseUrlSet = new Set<string>();
    for (const row of rows) {
      const epId = (row.endpointId || '').trim();
      const baseUrl = (row.url || '').trim();
      if (!epId || !baseUrl) continue;
      baseUrlSet.add(baseUrl);
      let headers: Record<string, string> | undefined;
      if (row.headersJson) {
        try {
          const parsed = JSON.parse(row.headersJson);
          if (parsed && typeof parsed === 'object') {
            const h: Record<string, string> = {};
            for (const [k, v] of Object.entries(
              parsed as Record<string, unknown>,
            )) {
              if (typeof k === 'string' && typeof v === 'string') {
                h[k] = v;
              }
            }
            if (Object.keys(h).length > 0) {
              headers = h;
            }
          }
        } catch {
          // ignore malformed headersJson
        }
      }
      byEndpoint[epId] = { baseUrl, headers };
    }
    return {
      byEndpoint,
      baseUrlOptions: Array.from(baseUrlSet),
    };
  }

  async setApiTestEndpointConfig(
    module: string,
    endpointId: string,
    input: {
      baseUrl?: string;
      headers?: Record<string, string> | null;
    },
    userId: number,
  ): Promise<void> {
    const safeModule = (module || '').trim().toLowerCase() || 'default';
    const epId = (endpointId || '').trim();
    if (!epId || !userId) return;

    const baseUrl =
      typeof input.baseUrl === 'string' ? input.baseUrl.trim() : '';
    const headersObj = input.headers ?? null;

    const existing = await this.apiTestBaseUrls.findOne({
      where: { userId, module: safeModule, endpointId: epId },
    });

    // If both baseUrl and headers are effectively empty, remove config
    const hasBase = !!baseUrl;
    const hasHeaders =
      !!headersObj && Object.keys(headersObj).some((k) => !!headersObj![k]);

    if (!hasBase && !hasHeaders) {
      if (existing) {
        await this.apiTestBaseUrls.remove(existing);
      }
      return;
    }

    const headersJson =
      headersObj && Object.keys(headersObj).length > 0
        ? JSON.stringify(headersObj)
        : null;
    const now = new Date();

    if (existing) {
      if (hasBase) existing.url = baseUrl;
      existing.headersJson = headersJson;
      existing.lastUsedAt = now;
      await this.apiTestBaseUrls.save(existing);
    } else {
      const row = this.apiTestBaseUrls.create({
        userId,
        module: safeModule,
        endpointId: epId,
        url: baseUrl || '',
        headersJson,
        usageCount: 1,
        createdAt: now,
        lastUsedAt: now,
      });
      await this.apiTestBaseUrls.save(row);
    }
  }

  async getCurlPayloads(
    userId?: number,
  ): Promise<
    Array<{
      method: string;
      category: string;
      url: string;
      headers: string;
      payload: string;
    }>
  > {
    const raw = await this.getValue('curlPayloads.json', userId);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => ({
          method:
            typeof item?.method === 'string' ? item.method.toUpperCase() : '',
          category: typeof item?.category === 'string' ? item.category : '',
          url: typeof item?.url === 'string' ? item.url : '',
          headers: typeof item?.headers === 'string' ? item.headers : '',
          payload: typeof item?.payload === 'string' ? item.payload : '',
        }))
        .filter((x) => x.method && x.category);
    } catch {
      return [];
    }
  }

  async upsertCurlPayload(
    input: {
      method: string;
      category: string;
      url: string;
      headers: string;
      payload: string;
    },
    userId?: number,
  ): Promise<{
    method: string;
    category: string;
    url: string;
    headers: string;
    payload: string;
  }> {
    const scopedKey = (suffix: string) =>
      this.makeKey(`curlPayloads.${suffix}`, userId ?? null);
    const normalized = {
      method: (input.method || '').toUpperCase(),
      category: (input.category || '').trim(),
      url: (input.url || '').trim(),
      headers: input.headers || '',
      payload: input.payload || '',
    };
    if (!normalized.method || !normalized.category) {
      throw new Error('method and category are required');
    }
    const existingRaw = await this.getValue('curlPayloads.json', userId);
    let list: Array<{
      method: string;
      category: string;
      url: string;
      headers: string;
      payload: string;
    }> = [];
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      } catch {
        list = [];
      }
    }
    const key = `${normalized.method}::${normalized.category}::${normalized.url}`;
    const next: typeof list = [];
    let replaced = false;
    for (const item of list) {
      const itemKey = `${(item.method || '').toUpperCase()}::${item.category || ''}::${item.url || ''}`;
      if (!replaced && itemKey === key) {
        next.push(normalized);
        replaced = true;
      } else {
        next.push(item);
      }
    }
    if (!replaced) {
      next.push(normalized);
    }
    await this.set(
      scopedKey('json'),
      JSON.stringify(next),
      { encrypt: false },
    );
    return normalized;
  }
}
