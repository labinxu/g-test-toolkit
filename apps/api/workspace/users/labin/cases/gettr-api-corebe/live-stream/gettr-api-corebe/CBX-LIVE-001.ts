// Auto-generated live stream user case
// Code: CBX-LIVE-001
// Feature: /u/live/join CBX Live 正常加入
// CSV ID: CBX-LIVE-JOIN
// Generated at: 2025-12-02T04:25:52.484Z
// Description:
//   作为观众,我可以加入一场 CBX Live 直播并获得聊天和拉流所需配置
//   CBX Live 流观众正常调用 /u/live/join 时返回结构正确且视图计数与 Redis 缓存写入符合预期
//   【前置条件】
//   qa12 环境; Mongo.cbx_live_info 中存在 postId=p_cbx_live_1s 且 is_live=true; 已有合法 viewer 账号
//   【测试步骤】
//   1. 使用已登录用户调用 POST /u/live/join,参数 postId=p_cbx_live_1s;2. 记录响应内容与 HTTP 状态码;3. 查询 Mongo.cbx_live_info 中该 post 的视图计数;4. 查询 Redis {postId}.lv_info 和 cbx-live:chat:{postId}:{viewerId}

// Acceptance Criteria:
//   返回 200 且响应结构与现有 Live Manager 保持兼容; 返回体中包含 RTM 配置; Mongo 视图计数加 1; Redis 写入 {postId}.lv_info 和 cbx-live:chat:{postId}:{viewerId}

import { describe, it, expect, useTestCase } from 'core-lib';

describe("[gettr-api-corebe] CBX-LIVE-001 作为观众,我可以加入一场 CBX Live 直播并获得聊天和拉流所需配置\n\nCBX Live 流观众正常调用 /u/live/join 时返回结构正确且视图计数与 Redis 缓存写入符合预期", () => {
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
    // Step 1: 使用已登录用户调用 POST /u/live/join,参数 postId=p_cbx_live_1s
    //   Data / Precondition: qa12 环境; Mongo.cbx_live_info 中存在 postId=p_cbx_live_1s 且 is_live=true; 已有合法 viewer 账号
    //   Expected: HTTP 状态码为 200
    // Step 2: 记录响应内容与 HTTP 状态码
    //   Expected: 返回 JSON 结构与原有 Live Manager 行为兼容,字段名和类型一致
    // Step 3: 查询 Mongo.cbx_live_info 中该 post 的视图计数
    //   Expected: 返回体中包含 RTM 配置信息(频道,token,uuid 等)
    // Step 4: 查询 Redis {postId}.lv_info 和 cbx-live:chat:{postId}:{viewerId}
    //   Expected: Mongo.cbx_live_info 视图计数在用例执行后相对初始值加 1
    // Step 5: 使用已登录用户调用 POST /u/live/join,参数 postId=p_cbx_live_1s
    //   Expected: Redis 中存在 {postId}.lv_info Hash 和 cbx-live:chat:{postId}:{viewerId} Hash,字段与业务逻辑一致

    // 示例：将上述步骤映射为实际 API 流程（仅供参考）：
    // const res = await apiPost('/admin/live/start', { /* TODO: 填写请求体 */ });
    // tc.assertEqual(200, res.status, '开播接口返回 200');
    // const json = await res.json();
    // tc.assertEqual(null, json.errcode, 'errcode 应为 null');
  });
});
