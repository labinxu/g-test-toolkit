import { describe, it, beforeAll, afterAll, afterEach, useTestCase } from 'core-lib';

// Auto-generated live stream suite
// Suite: HostSide
// Generated at: 2025-12-11T04:39:21.271Z

import { HomePage, LoginPage } from 'gettr-web-lib';

describe("[gettr-web] Suite: HostSide", () => {
  const tc = useTestCase({
    module: 'livestream',
    browser: {
      headless: false,
      debug: true,
    },
  });

  let homePage = new HomePage(tc as any);

  async function runSuitePreSteps() {
    // 套件级前置步骤（复用于套件中的所有用例）：
    // Step 1: Home page · Click Login button
    //   Expected: jump to login page
    let loginPage = await homePage.clickLoginButton();
    // Step 2: Login Page · Login With Account
    //   Expected: login failed
    homePage = await loginPage.loginAccount("post_notify_1", "a111111");
  }

  beforeAll(async () => {
    await runSuitePreSteps();
  });

  afterEach(async () => {
    // TODO: 如需在每个用例后清理状态，可在此补充；默认无需操作。
  });

  afterAll(async () => {
    // TODO: 如需在套件结束后释放资源，可在此补充；默认无需操作。
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
      tc.logger.info(`result ${waited}, ${waited} ${result},${result.displayed}`)
      tc.assertEqual(true, !!(result), "成功进入live host 页面");
    }
  });

});
