import { describe, it, expect, useTestCase } from 'core-lib';

// Live API - 正常开播（/admin/live/start）
// 说明：
// - 本用例针对直播域管理接口 /admin/live/start；
// - 实际请求体 / 环境依赖需根据当前环境补充（如 Mongo/Redis 预置数据、user_id 等）。
//
// 环境配置：
// - 全局：Settings → Parameters → API Tests 中配置 baseUrl / 默认 Header；
// - 运行前可在「用例库 / Testcases」中为平台 gettr-api-livestream + driver=other 选择 EnvTemplate，
//   其 config JSON 会与全局 apiTestConfig 合并（例如覆盖 baseUrl 或附加 Header）。

const tc = useTestCase({
  module: 'gettr-api-livestream',
  browser: false,
  android: false,
  tags: ['api', 'livestream', 'admin-live-start'],
});

type ApiTestConfig = {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  sampleLivePostId?: string;
};

function getApiTestConfig(): ApiTestConfig {
  const anyGlobal = globalThis as any;
  const baseCfg = (anyGlobal?.params?.apiTestConfig ?? {}) as Partial<ApiTestConfig>;
  const envCfgRaw = (anyGlobal?.params?.envConfig ?? null) as any;
  const envCfg =
    envCfgRaw && typeof envCfgRaw === 'object'
      ? (envCfgRaw as Partial<ApiTestConfig>)
      : ({} as Partial<ApiTestConfig>);
  const merged: Partial<ApiTestConfig> = { ...baseCfg, ...envCfg };
  if (!merged.baseUrl) {
    throw new Error(
      'apiTestConfig.baseUrl is not configured. 请在 Settings → Parameters → API Tests 或环境模板中配置 baseUrl。',
    );
  }
  return merged as ApiTestConfig;
}

async function apiRequest(path: string, init: RequestInit = {}) {
  const { baseUrl, defaultHeaders } = getApiTestConfig();
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    ...(defaultHeaders || {}),
    ...(init.headers as Record<string, string> | undefined || {}),
  };
  const res = await fetch(url, { ...init, headers });
  return res;
}

async function apiPost(path: string, body?: any, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined || {}),
  };
  return apiRequest(path, {
    ...init,
    method: 'POST',
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
}

describe('[gettr-api-livestream] LIVE-API-001 /admin/live/start success', () => {
  it('should create a live stream and return post_id', async () => {
    // TODO: 按当前环境补充一个有效的 user_id 及请求体字段
    const requestBody: any = {
      // user_id: 123,
      // channel_id: 'xxx',
      // session_id: 'yyy',
    };

    const res = await apiPost('/admin/live/start', requestBody);
    tc.assertEqual(200, res.status, '开播接口返回 200');

    const json: any = await res.json().catch(() => null);
    expect(json).not.toBeNull();

    // 根据直播域约定检查基础字段（可按实际结构调整）
    // 例如：{ errcode: null, result: { post_id, is_live, viewers, ... } }
    const errcode = json?.errcode ?? json?.error_code ?? null;
    tc.assertEqual(null, errcode, '开播接口 errcode 应为 null');

    const result = json?.result ?? json?.data ?? json;
    expect(result).toBeDefined();

    // post_id 存在且 is_live = true
    const postId = result?.post_id ?? result?.postId ?? null;
    tc.assertNotNull(postId, '返回中应包含 post_id');

    const isLive = result?.is_live ?? result?.isLive;
    tc.assertEqual(true, !!isLive, '返回中 is_live 应为 true');

    // viewers 初始值校验（>= 0）
    const viewers = Number(result?.viewers ?? 0);
    expect(Number.isFinite(viewers)).toBe(true);
    expect(viewers).toBeGreaterThanOrEqual(0);
  });
}
);

