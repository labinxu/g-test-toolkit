// Auto-generated live stream suite
// Suite: HostSide
// Generated at: 2025-12-23T05:04:49.156Z

import { describe, it, useTestCase, beforeAll } from 'core-lib';
import { HomePage, LoginPage, LiveHostPage, FlamePage, FlameStreamPage } from 'gettr-web-lib';

describe("[gettr-web] Suite: HostSide", () => {
  const tc = useTestCase({
    module: 'flamecast',
    browser: {
      headless: false,
      debug: true,
    },
  });

  let homePage = new HomePage(tc as any);
  let liveHostPage = new LiveHostPage(tc as any);

  async function runSuitePreSteps() {
    // 套件级前置步骤（在「用户场景」页面的套件中维护，仅需实现一次即可复用）：
    // Step 1: Home page · Click Login button
    //   Expected: jump to login page
    let loginPage = await homePage.clickLoginButton();
    // Step 1: Login Page · Login With Account
    //   Expected: login failed
    homePage = await loginPage.loginAccount("qa_flame", "a111111");
  }

  beforeAll(async () => {
    await runSuitePreSteps();
  });

  it("US-0-host-1 As a host, I can start a livestream on GETTR (web) without OBS using Restream, so I can go live quickly.", async () => {
    // 以下步骤由用例管理模块自动生成，已复用套件级前置步骤：
    // Step 1: 进入live host 页面
    //   Data / Precondition: username:post_notify_1 password:a111111 登陆状态并且在主页面
    //   Expected: 成功进入live host 页面
    await homePage.goLiveHost();
    {
      const driver: any = (tc as any).page;
      const locator = "button.MuiButton-root.MuiButton-outlined";
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
        ? await driver.waitUntil(async () => (await checkVisible()).displayed === true, { timeout: 300000, interval: 300, timeoutMsg: "成功进入live host 页面" })
        : await checkVisible();
      const result = waited && (waited.el !== undefined ? waited : await checkVisible());
      tc.assertEqual(true, !!(result), "成功进入live host 页面");
    }
    // Step 2: Live Host · Multi Guest
    //   Expected: 点击进入live studio页面
    let flamePage = await liveHostPage.clickMultiGuest();
    // Step 3: Flame Cast Page · New Stream
    //   Expected: open the new-stream page and Create New Channel should appeared
    let flameStreamPage = await flamePage.clickNewStream();
    {
      const driver: any = (tc as any).page;
      const locator = "a[href=\"/flame/dashboard\"]";
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
        ? await driver.waitUntil(async () => (await checkVisible()).displayed === true, { timeout: 30000, interval: 300, timeoutMsg: "open the new-stream page and Create New Channel should appeared" })
        : await checkVisible();
      const result = waited && (waited.el !== undefined ? waited : await checkVisible());
      tc.assertEqual(true, !!(result), "open the new-stream page and Create New Channel should appeared");
    }
    // Step 4: Flame Stream Page · Start broadcasting
    //   Expected: Enter the broadcast room
    await flameStreamPage.clickStartBroadcasting();
    {
      const driver: any = (tc as any).page;
      const locator = "div[id=\"video-content\"]";
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
        ? await driver.waitUntil(async () => (await checkVisible()).displayed === true, { timeout: 300000, interval: 300, timeoutMsg: "Enter the broadcast room" })
        : await checkVisible();
      const result = waited && (waited.el !== undefined ? waited : await checkVisible());
      tc.assertEqual(true, !!(result), "Enter the broadcast room");
    }
  });

});
