import { describe, it, beforeAll, useTestCase } from 'core-lib'
import { HomePage } from 'gettr-web-lib'

// BDD 风格：在 stg 环境批量发帖
describe('stg posts', () => {
  const tc = useTestCase({
    module: 'post',
    browser: {
      headless: false,
      debug: true,
      domain: 'https://stg.gettr.com',
      // timeout、retry 使用默认值即可，如需可在此覆盖
    },
  })

  let home: HomePage

  beforeAll(async () => {
    home = new HomePage(tc as any)
    const loginPage = await home.gotoLoginPage()
    home = await loginPage.loginWithPassword('stg_lb@mailinator.com', 'a111111')
  })

  it('post 200 text messages', async () => {
    let counter = 200
    while (counter > 0) {
      await home.post(`post ${counter}`)
      counter -= 1
      // 复用原有节奏控制
      await (home as any).delay?.()
    }
  })
})
