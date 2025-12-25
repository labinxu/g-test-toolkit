// Auto-generated live stream suite
// Suite: live studio status check
// Generated at: 2025-12-25T13:01:51.867Z

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, useTestCase, beforeAll } from 'core-lib';
import { HomePage, LoginPage, LivePage } from 'gettr-web-lib';

describe("[gettr-web] Suite: live studio status check", () => {
  const tc = useTestCase({
    module: 'liveStudio',
    browser: {
      headless: false,
      debug: true,
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
      if (typeof page.screenshot !== 'function') return;
      const ts = Date.now();
      const title = (current?.currentTest?.title || 'case').toString().replace(/\s+/g, '_');
      const name = "gettr-web" + '-' + "liveStudio" + '-' + title + '-' + ts + '.png';
      const base64 = await page.screenshot({ encoding: 'base64', fullPage: true });
      const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default as any;
      const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const resp = await fetchFn(`${apiBase.replace(/\/$/, '')}/api/testcase/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: base64,
          platform: "gettr-web",
          module: "liveStudio",
          caseName: title,
          filename: name,
          root: 'user',
        }),
      });
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

  async function runSuitePreSteps() {
    // 套件级前置步骤（在「用户场景」页面的套件中维护，仅需实现一次即可复用）：
    // Step 1: Home page · Click Login button
    //   Expected: jump to login page
    let loginPage = await homePage.clickLoginButton();
    // Step 1: Login Page · Login With Account
    //   Expected: login successful
    homePage = await loginPage.loginAccount("post_notify_2", "a111111");
    {
      const driver: any = (tc as any).page;
      const locator = "div.user-menu-trigger";
      const checkVisible = async () => {
        try {
          const el = driver && typeof driver.$ === 'function' ? await driver.$(locator) : null;
          const displayed = el && typeof el.isDisplayed === 'function' ? await el.isDisplayed() : !!el;
          return { el, displayed };
        } catch {
          return { el: null, displayed: false };
        }
      };
      const waited = driver && typeof driver.waitUntil === 'function'
        ? await driver.waitUntil(async () => (await checkVisible()).displayed === true, { timeout: 300000, interval: 300, timeoutMsg: "login successful" })
        : await checkVisible();
      const result = waited && (waited.el !== undefined ? waited : await checkVisible());
      tc.assertEqual(true, !!(result), "login successful");
    }
  }

  beforeAll(async () => {
    await runSuitePreSteps();
  });

  it("US-0-user-check-livestream-status Check status of the living studio", async () => {
    // 以下步骤由用例管理模块自动生成，已复用套件级前置步骤：
    // Step 1: Home page · Click Live Tab
    //   Expected: 出现直播/回放列表
    let livePage = await homePage.clickLiveTab();
    {
      const driver: any = (tc as any).page;
      const locator = "div[role=\"main\"]";
      const checkVisible = async () => {
        try {
          const el = driver && typeof driver.$ === 'function' ? await driver.$(locator) : null;
          const displayed = el && typeof el.isDisplayed === 'function' ? await el.isDisplayed() : !!el;
          return { el, displayed };
        } catch {
          return { el: null, displayed: false };
        }
      };
      const waited = driver && typeof driver.waitUntil === 'function'
        ? await driver.waitUntil(async () => (await checkVisible()).displayed === true, { timeout: 300000, interval: 300, timeoutMsg: "出现直播/回放列表" })
        : await checkVisible();
      const result = waited && (waited.el !== undefined ? waited : await checkVisible());
      tc.assertEqual(true, !!(result), "出现直播/回放列表");
    }
  });

});
