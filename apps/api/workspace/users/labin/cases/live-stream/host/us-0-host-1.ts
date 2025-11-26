import { describe, it, beforeAll, useTestCase } from 'core-lib'
import { HomePage, LoginPage, LiveStreamPage } from 'gettr-web-lib'

// US-0-host-1
// As a host, I can start a livestream on GETTR (web) without OBS using Restream,
// so I can go live quickly.
//
// 目标：
// - 从 Studio 打开到真正“直播中”控制在 30s 内；
// - 无需手动输入 RTMP / key；
// - 观众端可以看到直播，Studio 中有连接状态指示。

describe('[live-stream] US-0-host-1 start livestream from Studio', () => {
  const tc = useTestCase({
    module: 'live-stream',
    browser: {
      headless: false,
      debug: true,
      domain: 'https://stg.gettr.com',
      // 如需在其他环境运行，请调整 domain、账号密码等信息。
    },
  })

  let home: HomePage
  let loginPage: LoginPage

  beforeAll(async () => {
    home = new HomePage(tc as any)
    // TODO: 按需调整账号信息
    loginPage = await home.gotoLoginPage()
    home = await loginPage.loginWithPassword('stg_lb@mailinator.com', 'a111111')
  })

  it('host can start a livestream from Studio without manual RTMP', async () => {
    const live = new LiveStreamPage(tc as any)
    // 后续可在 LiveStreamPage 内细化 hostOpenStudioFromHome / hostStartLivestreamWithoutRTMP 等实现
    await live.runUS_0_host_1_startFromStudio()
  })
}
)

