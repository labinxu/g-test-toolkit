import { describe, it, beforeAll, useTestCase } from 'core-lib'
import { HomeDemoPage } from 'gettr-web-lib'

// BDD 风格：在 stg 环境批量发帖
describe('stg posts', () => {
  const tc = useTestCase({
    module: 'post',
    // browser: {
    //   headless: false,
    //   debug: true,
    //   domain: 'https://stg.gettr.com',
    //   // timeout、retry 使用默认值即可，如需可在此覆盖
    // },
  })

  let home: HomeDemoPage

  beforeAll(async () => {
    home = new HomeDemoPage(tc as any)
    home.loginWithPassword('aa','tt')
  })

  it('post 200 text messages', async () => {
    console.log('test case 200')
  })
})
