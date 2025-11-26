import { describe, it, beforeAll, afterAll, useTestCase } from 'core-lib'
import { LaunchPage,HomePage,LoginPage } from 'gettr-android-lib';

// BDD 模板：Android 登录流程
// 使用 useTestCase 声明运行环境与标签；在 it() 中直接使用 tc（TestCase 代理）的方法

describe('APPLogin', () => {
  // 直接在 useTestCase.android 传入配置（无需环境变量）
  const tc = useTestCase({
    module: 'LOGIN',
    android: {
      deviceName: 'smatisan',
      udid: '832dc799',
      apk: '1.74.7__251112028__ids.apk',
      preUninstallPackages: ['com.gettr.gettr', 'org.app.getter'],
      preUninstallOnInstall: true,
      // installBehavior: 'install',      // or 'launch'
      // bringToFront: true,
      // 直启模式示例：
      // appPackage: 'com.gettr.gettr',
      // appActivity: '.MainActivity',
    },
    keepAppOpen: true,
    shareSession: true,
    tags: ['REQ:PRD:feat-proj-0001'], // Traceability: 需求标签
  })

  beforeAll(async () => {
    tc.logger?.debug('准备登录场景（示例）')
    // 示例：确保停留在登录页，可在此做前置操作
  })

  afterAll(async () => {
    tc.logger?.debug('清理登录场景（示例）')
  })

  it('启动后展示登录页', async () => {
    // Per-test TestRail overrides (and tags for compatibility)
    tc.setCaseTestrail?.({
      template: 'Exploratory Session',
      type: 'Regression',
      priority: 'High',
      section: 'Android/Login',
    })
    tc.addCaseTags?.([
      'TR:TPL:Exploratory Session',
      'TR:TYPE:Regression',
      'TR:PRIO:High',
      'TR:SEC:Android/Login',
    ])
    tc.appendLog?.('检查登录按钮是否存在（示例）')
    //const driver: any = (tc as any).page // WebdriverIO driver
    // const loginBtn = await driver.$('~loginButton')
    // tc.assertNotNull(loginBtn, '应存在登录按钮')
    //tc.assertEqual(1, 1, 'Sanity')
  })

  it('LoginWithUsername', async () => {
    // Different overrides for this test
    tc.setCaseTestrail?.({
      template: 'Test Case',
      type: 'Functional',
      priority: 'Critical',
      section: 'Android/Login',
    })
    tc.addCaseTags?.([
      'TR:TPL:Test Case',
      'TR:TYPE:Functional',
      'TR:PRIO:Critical',
      'TR:SEC:Android/Login',
    ])
    const launchPage = new LaunchPage(tc);
    const loginPage = await launchPage.loginPage()
    const homePage = await loginPage.loginWithUsername('rel_qa','a111111')
    //const driver: any = (tc as any).page
    // 示例：根据实际控件树调整选择器
    // const username = await driver.$('~username')
    // await username.setValue('user@example.com')
    // const password = await driver.$('~password')
    // await password.setValue('a_strong_password')
    // const submit = await driver.$('~submitLogin')
    // await submit.click()
    // 断言：登录成功提示或首页元素
    tc.appendLog?.('已执行登录动作（示例）')
  })
})
