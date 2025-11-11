import { describe, it, beforeAll, afterAll, useTestCase } from 'core-lib'

// BDD 模板：Android 登录流程（直启模式：appPackage + appActivity）
// 设备、包名与 Activity 均在 useTestCase.android 字段中直接传入，无需环境变量。

describe('Android login flow (launch mode)', () => {
  const tc = useTestCase({
    module: 'android-login',
    android: {
      deviceName: 'pixel6',
      udid: 'emulator-5554',
      appPackage: 'com.gettr.gettr',
      appActivity: '.MainActivity',
      keepAppOpen: true,
      bringToFront: true,
      preUninstallPackages: ['com.gettr.gettr', 'org.app.getter'],
      preUninstallOnInstall: true,
    },
    keepAppOpen: true,
    shareSession: true,
    tags: ['REQ:PRD:feat-proj-0001'], // Traceability: 需求标签
  })

  beforeAll(async () => {
    tc.logger?.debug('准备登录场景（直启模式示例）')
  })

  afterAll(async () => {
    tc.logger?.debug('清理登录场景（直启模式示例）')
  })

  it('启动后展示登录页（直启）', async () => {
    tc.setCaseTestrail?.({
      template: 'Test Case',
      type: 'Smoke',
      priority: 'High',
      section: 'Android/Launch',
    })
    tc.addCaseTags?.([
      'TR:TPL:Test Case',
      'TR:TYPE:Smoke',
      'TR:PRIO:High',
      'TR:SEC:Android/Launch',
    ])
    tc.appendLog?.('检查登录按钮是否存在（示例）')
    const driver: any = (tc as any).page // WebdriverIO driver
    // const loginBtn = await driver.$('~loginButton')
    // tc.assertNotNull(loginBtn, '应存在登录按钮')
    tc.assertEqual(1, 1, 'Sanity')
  })

  it('输入账号密码并登录（直启）', async () => {
    tc.setCaseTestrail?.({
      template: 'Test Case',
      type: 'Functional',
      priority: 'Medium',
      section: 'Android/Launch',
    })
    tc.addCaseTags?.([
      'TR:TPL:Test Case',
      'TR:TYPE:Functional',
      'TR:PRIO:Medium',
      'TR:SEC:Android/Launch',
    ])
    const driver: any = (tc as any).page
    // 示例：根据实际控件树调整选择器
    // const username = await driver.$('~username')
    // await username.setValue('user@example.com')
    // const password = await driver.$('~password')
    // await password.setValue('a_strong_password')
    // const submit = await driver.$('~submitLogin')
    // await submit.click()
    // 断言：登录成功提示或首页元素
    tc.appendLog?.('已执行登录动作（直启示例）')
  })
})
