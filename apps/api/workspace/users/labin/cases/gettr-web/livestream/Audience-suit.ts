import { describe, it, beforeAll, afterAll, afterEach, useTestCase } from 'core-lib';

// Auto-generated live stream suite
// Suite: Audience-suit
// Generated at: 2025-12-10T06:08:21.349Z

import { HomePage, LoginPage } from 'gettr-web-lib';

describe("[gettr-web] Suite: Audience-suit", () => {
  // Env template: CBX-LIVE-QA12 (cbx-live-qa12)
  const tc = useTestCase({
    module: 'livestream',
    browser: {
        "headless": false,
        "debug": true,
        "domain": "https://qa12.gettr-qa.com"
    },
  });

  let homePage= new HomePage(tc);
  async function runSuitePreSteps() {
    // 套件级前置步骤（复用于套件中的所有用例）：
    // Step 1: Home page · Click Login button
    //   Expected: jump to login page
    let loginPage = await homePage.clickLoginButton();
    {
      const driver: any = (tc as any).page;
      let el: any = null;
      try {
        el = driver && typeof driver.$ === 'function' ? await driver.$("h2.MuiTypography-root") : null;
      } catch (e) {
        el = null;
      }
      tc.assertNotNull(el, "jump to login page");
    }
    // Step 2: Login Page · Login With Account
    //   Expected: 登陆失败
    homePage = await loginPage.loginAccount("post_notify_1", "a111111");
    {
      const driver: any = (tc as any).page;
      let el: any = null;
      try {
        el = driver && typeof driver.$ === 'function' ? await driver.$("div#user-menu-root") : null;
      } catch (e) {
        el = null;
      }
      tc.assertNotNull(el, "登陆失败");
    }
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

  it("US-0-guest-1 As a guest, I can open the invite link and reach the join page.", async () => {
    // 以下步骤由用例管理模块自动生成，已复用套件级前置步骤：
    // Step 1: 点击 live 标签页
    //   Expected: 出现propular following history 标签
    await homePage.clickLiveTab();
    {
      const driver: any = (tc as any).page;
      let el: any = null;
      try {
        el = driver && typeof driver.$ === 'function' ? await driver.$("div.MuiTabs-scroller.MuiTabs-fixed") : null;
      } catch (e) {
        el = null;
      }
      tc.assertNotNull(el, "出现propular following history 标签");
    }
  });

});
