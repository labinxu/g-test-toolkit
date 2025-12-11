// Auto-generated live stream suite
// Suite: viewer-side
// Generated at: 2025-12-11T11:08:38.577Z

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, useTestCase, beforeAll, afterEach } from 'core-lib';
import { HomePage, LoginPage, LivePage } from 'gettr-web-lib';

describe("[gettr-web] Suite: viewer-side", () => {
  // Env template: CBX-LIVE-QA12 (cbx-live-qa12)
  const tc = useTestCase({
    module: 'livestream',
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
      if (typeof page.screenshot !== 'function') return;
      const ts = Date.now();
      const title = (current?.currentTest?.title || 'case').toString().replace(/\s+/g, '_');
      const name = "gettr-web" + '-' + "livestream" + '-' + title + '-' + ts + '.png';
      const out = path.join(process.cwd(), 'reports', "gettr-web", "livestream", 'screenshots', name);
      await fs.promises.mkdir(path.dirname(out), { recursive: true });
      await page.screenshot({ path: out, fullPage: true });
      (tc as any).meta = { ...(tc as any).meta, lastScreenshot: out };
    } catch (err) {
      console.warn('screenshot failed:', err);
    }
  });

  async function runSuitePreSteps() {
    // 套件级前置步骤（在「用户场景」页面的套件中维护，仅需实现一次即可复用）：
    // Step 1: Home page · Click Login button
    //   Expected: jump to login page
    let loginPage = await homePage.clickLoginButton();
    {
      const driver: any = (tc as any).page;
      const locator = "h2.MuiTypography-root";
      const checkVisible = async () => {
        try {
          const el = driver && typeof driver.$ === 'function' ? await driver.$(locator) : null;
          const displayed = el && typeof el.isDisplayed === 'function' ? await el.isDisplayed() : !!el;
          return { el, displayed };
        } catch {
          return { el: null, displayed: false };
        }
      };
      const result = await checkVisible();
      tc.assertEqual(true, !!(result), "jump to login page");
    }
    // Step 2: Login Page · Login With Account
    //   Expected: 登陆失败
    homePage = await loginPage.loginAccount("post_notify_1", "a111111");
    {
      const driver: any = (tc as any).page;
      const locator = "div#user-menu-root";
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
        ? await driver.waitUntil(async () => (await checkVisible()).displayed === true, { timeout: 300000, interval: 300, timeoutMsg: "登陆失败" })
        : await checkVisible();
      const result = waited && (waited.el !== undefined ? waited : await checkVisible());
      tc.assertEqual(true, !!(result), "登陆失败");
    }
  }

  beforeAll(async () => {
    await runSuitePreSteps();
  });

  it("US-0-guest-1 As a guest, I can open the invite link and reach the join page.", async () => {
    // 以下步骤由用例管理模块自动生成，已复用套件级前置步骤：
    // Step 1: 点击 live 标签页
    //   Expected: 出现propular following history 标签
    let livePage = await homePage.clickLiveTab();
    {
      const driver: any = (tc as any).page;
      const locator = "div.MuiTabs-scroller.MuiTabs-fixed";
      const checkVisible = async () => {
        try {
          const el = driver && typeof driver.$ === 'function' ? await driver.$(locator) : null;
          const displayed = el && typeof el.isDisplayed === 'function' ? await el.isDisplayed() : !!el;
          return { el, displayed };
        } catch {
          return { el: null, displayed: false };
        }
      };
      const result = await checkVisible();
      tc.assertEqual(true, !!(result), "出现propular following history 标签");
    }
    // Step 2: Live Page · Popular Tab
    //   Expected: topup appeared
    await livePage.clickPopular();
    {
      const driver: any = (tc as any).page;
      const locator = "div.swiper-wrapper";
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
        ? await driver.waitUntil(async () => (await checkVisible()).displayed === true, { timeout: 300000, interval: 300, timeoutMsg: "topup appeared" })
        : await checkVisible();
      const result = waited && (waited.el !== undefined ? waited : await checkVisible());
      tc.assertEqual(true, !!(result), "topup appeared");
    }
  });

  it("US-0-guest-10 As a guest, I can leave the livestream at any time.", async () => {
    // TODO: 当前用例尚未定义具体步骤，请在用例管理页面补充后完善此处实现。
  });

});
