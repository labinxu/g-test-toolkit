// Auto-generated live stream user case
// Code: CBX-LIVE-012
// Feature: /u/live/join RTM 配置正确性
// CSV ID: CBX-LIVE-RTM
// Generated at: 2025-12-02T04:25:23.070Z
// Description:
//   作为观众,我希望通过 /u/live/join 获得可信的 RTM 配置信息以加入聊天
//   通过 /u/live/join 返回的 RTM/PubNub 配置应为真实可用值且结构正确
//   【前置条件】
//   qa12 环境已正确配置 PubNub/RTM 相关密钥; 存在可用 CBX Live
//   【测试步骤】
//   1. 调用 /u/live/join 获取响应 JSON;2. 提取其中的 RTM/ PubNub 配置字段;3. 校验 key,channel,uuid,auth token 的取值;4. 模拟 pubnubSecretKey 缺失场景,再次调用接口

// Acceptance Criteria:
//   RTM 配置中使用真实 pubnub key 非 mock 值,channel 和 uuid 等字段符合约定,在 secret 缺失等异常情况下接口返回清晰业务错误而非 500

import { describe, it, expect, useTestCase } from 'core-lib';

describe("[gettr-api-corebe] CBX-LIVE-012 作为观众,我希望通过 /u/live/join 获得可信的 RTM 配置信息以加入聊天\n\n通过 /u/live/join 返回的 RTM/PubNub 配置应为真实可用值且结构正确", () => {
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
    // Step 1: 调用 /u/live/join 获取响应 JSON
    //   Data / Precondition: qa12 环境已正确配置 PubNub/RTM 相关密钥; 存在可用 CBX Live
    //   Expected: 正常场景下返回的 key 非显式 mock/test 值
    // Step 2: 提取其中的 RTM/ PubNub 配置字段
    //   Expected: channel 和 uuid 等字段命名和内容符合系统约定
    // Step 3: 校验 key,channel,uuid,auth token 的取值
    //   Expected: 在 secret 缺失等异常场景下,接口返回带有清晰业务错误码和信息的响应,HTTP 500 率可控
    // Step 4: 模拟 pubnubSecretKey 缺失场景,再次调用接口
    //   Expected: 日志中有合理的错误说明而非空指针等低级异常

    // 示例：将上述步骤映射为实际 API 流程（仅供参考）：
    // const res = await apiPost('/admin/live/start', { /* TODO: 填写请求体 */ });
    // tc.assertEqual(200, res.status, '开播接口返回 200');
    // const json = await res.json();
    // tc.assertEqual(null, json.errcode, 'errcode 应为 null');
  });
});
