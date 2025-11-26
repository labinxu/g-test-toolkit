// Auto-generated live stream user case
// Code: US-0-login-0001
// Feature: mobile login
// Generated at: 2025-11-30T18:06:06.490Z
// Description:
//   the customer can login with his username /email and password

// Acceptance Criteria:
//   the user can login and jump into home page

import { describe, it, useTestCase } from 'core-lib';
import { LaunchPage, LoginPage } from 'gettr-android-lib';

describe("[android] US-0-login-0001 user can login with email or username", () => {
  // Env template: Smatisan (smatisan)
  const tc = useTestCase({
    module: 'login',
    android: {
        "deviceName": "smatisan",
        "udid": "832dc799",
        "apk": "1.75.1__251128164_.apk"
    },
    keepAppOpen: true,
    shareSession: true,
  });

  const launch = new LaunchPage(tc as any);
  const login = new LoginPage(tc as any);

  it('should satisfy all defined steps', async () => {
    // 以下步骤由用例管理模块自动生成，对应 gettr-android-lib 中的页面与方法：
    // Step 1: LaunchPage · loginPage
    //   Expected: entry login page
    await launch.loginPage();
    // Step 2: LoginPage · Login with password
    //   Data / Precondition: username=qa_lb, password=a111111
    //   Expected: Remind me later not found,
    await login.loginWithPassword("qa_lb", "a111111");
    {
      const driver: any = (tc as any).page;
      let el: any = null;
      try {
        el = driver && typeof driver.$ === 'function' ? await driver.$("welcomePage_remind_btn") : null;
      } catch (e) {
        el = null;
      }
      tc.assertNotNull(el, "Remind me later not found,");
    }
  });
});
