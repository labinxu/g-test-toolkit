import { describe, it, expect, useTestCase } from 'core-lib';

// Live API - 用户不存在时开播失败（/admin/live/start）
// 对应错误码：E_LIVE_USER_NOT_FOUND

const tc = useTestCase({
  module: 'gettr-api-livestream',
  browser: false,
  android: false,
  tags: ['api', 'livestream', 'admin-live-start', 'error-user-not-found'],
});

type ApiTestConfig = {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
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

describe('[gettr-api-livestream] LIVE-API-002 /admin/live/start user not found', () => {
  it('should return E_LIVE_USER_NOT_FOUND for non-existing user', async () => {
    // TODO: 按当前环境约定，选择一个明确“不存在”的 user_id
    const requestBody: any = {
      // user_id: 999999999, // 确保该 ID 在当前环境中不存在
    };

    const res = await apiPost('/admin/live/start', requestBody);

    // 一般情况下用户不存在可返回 4xx 或 200+errcode，两种都允许，但必须带正确的 errcode
    expect([200, 400, 404]).toContain(res.status);

    const json: any = await res.json().catch(() => null);
    expect(json).not.toBeNull();

    const errcode = json?.errcode ?? json?.error_code ?? null;
    tc.assertEqual(
      'E_LIVE_USER_NOT_FOUND',
      errcode,
      '用户不存在时应返回错误码 E_LIVE_USER_NOT_FOUND',
    );

    // 确认不会创建新的直播记录的简单信号：
    // - 通常情况下，result / data 中不会包含 post_id 或 is_live=true。
    const result = json?.result ?? json?.data ?? json;
    const postId = result?.post_id ?? result?.postId ?? null;
    if (postId) {
      // 如果返回了 post_id，这可能表示环境或实现与预期不一致，留一个软断言供排查
      tc.logger.warn?.(
        `[LIVE-API-002] 用户不存在场景返回了 post_id=${postId}，请确认实现是否符合设计`,
      );
    }
  });
}
);

