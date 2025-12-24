// Auto-generated live stream suite
// Suite: suitdemo
// Generated at: 2025-12-15T08:29:42.739Z

import { describe, it, useTestCase } from 'core-lib';
import { HomePage } from 'gettr-web-lib';

describe("[gettr-web] Suite: suitdemo", () => {
  const tc = useTestCase({
    module: 'flamecast',
    browser: {
      headless: false,
      debug: true,
    },
  });

  let homePage = new HomePage(tc as any);

  async function runSuitePreSteps() {
    // 套件级前置步骤：尚未填写，可在套件中补充前置步骤说明并重新生成。
  }

  it("US-0-failed-test test failed case page snapshot", async () => {
    // 以下步骤由用例管理模块自动生成，已复用套件级前置步骤：
    // Step 1: 登陆失败
    //   Expected: （待补充）
    await homePage.goLiveHost();
  });

});
