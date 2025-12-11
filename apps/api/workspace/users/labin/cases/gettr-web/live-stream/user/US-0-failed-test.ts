// Auto-generated live stream user case
// Code: US-0-failed-test
// Feature: Tool
// Generated at: 2025-12-11T12:18:51.602Z
// Acceptance Criteria:
//   测试 工具本身

import { describe, it, useTestCase, afterEach } from 'core-lib';
import { HomePage } from 'gettr-web-lib';

describe("[gettr-web] US-0-failed-test test failed case page snapshot", () => {
  // Env template: CBX-LIVE-QA12 (cbx-live-qa12)
  const tc = useTestCase({
    module: 'live-stream',
    browser: {
        "headless": false,
        "debug": true,
        "domain": "https://qa12.gettr-qa.com"
    },
  });

  let homePage = new HomePage(tc as any);

  afterEach(async function () {
    try {
      const current: any = this as any;
      const failed =
        (current?.currentTest?.state && current.currentTest.state !== 'passed') || !!current?.currentTest?.err;
      if (!failed) return;
      const page: any = (tc as any)?.page;
      if (!page || page.isClosed?.()) return;
      homePage.logger.error('afterEach')
      if (typeof page.screenshot !== 'function') return;
      const ts = Date.now();
      const title = (current?.currentTest?.title || "US-0-failed-test").toString().replace(/\s+/g, '_');
      const name = "gettr-web" + '-' + "live-stream" + '-' + title + '-' + ts + '.png';
      const base64 = await page.screenshot({ encoding: 'base64', fullPage: true });
      const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default as any;
      const apiBase = 'http://localhost:3001';
      const resp = await fetchFn(`${apiBase.replace(/\/$/, '')}/api/testcase/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: base64,
          platform: "gettr-web",
          module: "live-stream",
          caseName: title,
          filename: name,
          root: 'user',
        }),
      });
      homePage.logger.error('afterEach2')
      if (resp.ok) {
        const result = await resp.json();
        (tc as any).meta = { ...(tc as any).meta, lastScreenshot: result?.path };
        console.log('[screenshot]', result?.path);
      } else {
        console.warn('upload screenshot failed', resp.status);
      }
    } catch (err) {
      console.warn('screenshot failed:', err);
    }
  });

  it('should satisfy all defined steps', async () => {
    // 以下步骤由用例管理模块自动生成，对应 gettr-web-lib 中的页面与方法：
    // Step 1: 登陆失败
    //   Expected: （待补充）
    await homePage.goLiveHost();
  });
});
