// Auto-generated live stream user case
// Code: TC01
// Feature: 开播
// Generated at: 2025-12-01T15:26:37.514Z
// Description:
//   正常开播(API)
//   【前置条件】
//   已有有效 user_id, 用户未在播, channel/session 参数合法
//   【测试步骤】
//   1. 调用 POST /admin/live/start 传入合法请求体；2. 查询 Mongo cbx_live_info 和 user 文档；3. 查询 Redis {post_id}.lv_info 及用户缓存

import { describe, it, expect, useTestCase } from 'core-lib';

describe("[gettr-api-livestream] TC01 正常开播(API)", () => {
  const tc = useTestCase({
    module: 'live-stream',
    browser: false,
    android: false,
    tags: ['api', 'livestream'],
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
      envCfgRaw && typeof envCfgRaw === "object"
        ? (envCfgRaw as Partial<ApiTestConfig>)
        : ({} as Partial<ApiTestConfig>);
    const merged: Partial<ApiTestConfig> = { ...baseCfg, ...envCfg };
    if (!merged.baseUrl) {
      throw new Error('apiTestConfig.baseUrl is not configured. 请在 Settings → Parameters → API Tests 中配置。');
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
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined || {}) };
    return apiRequest(path, { ...init, method: 'POST', headers, body: body == null ? undefined : JSON.stringify(body) });
  }

  it('should satisfy all defined steps', async () => {
    // 以下步骤由用例管理模块自动生成，请根据需要将其转换为具体 API 调用与断言：
    // Step 1: 调用 POST /admin/live/start 传入合法请求体
    //   Data / Precondition: 已有有效 user_id, 用户未在播, channel/session 参数合法
    //   Expected: 接口 200, errcode=null, 返回 post_id/is_live=true/viewers=0
    // Step 2: 查询 Mongo cbx_live_info 和 user 文档
    //   Expected: cbx_live_info 新增记录, is_live=true, version=1, started_at 有值
    // Step 3: 查询 Redis {post_id}.lv_info 及用户缓存
    //   Expected: user 文档 lv_pst=post_id, streaming.{post_id}=channel_id
    // Step 4: 调用 POST /admin/live/start 传入合法请求体
    //   Expected: Redis 有 {post_id}.lv_info(TTL≈7天) 和用户缓存更新, 活跃列表/expose hash 已创建

    // 示例：将上述步骤映射为实际 API 流程（仅供参考）：
    // const res = await apiPost('/admin/live/start', { /* TODO: 填写请求体 */ });
    // tc.assertEqual(200, res.status, '开播接口返回 200');
    // const json = await res.json();
    // tc.assertEqual(null, json.errcode, 'errcode 应为 null');
  });
});
