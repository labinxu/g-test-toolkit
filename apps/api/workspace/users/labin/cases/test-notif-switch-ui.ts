import { TestCase, Test, withBrowser, useBrowser } from 'core-lib'
@Test({ module: 'notification' })
@withBrowser({ headless: false, debug: true })
export class TestNotifSwitchUI extends TestCase {
  async tearUp() {
    await super.tearUp?.()
    // Attach requirement tag for traceability suggestions
    this.setReportMetadata({ tags: ['REQ:PRD:feat-proj-0001'] })
  }
  async test_check_notif_setting() {
    const result = await this.login({
      url: 'https://qa1-prod.gettr-qa.com/login?step=sea_login_with_email',
      account: 'post_notify_1',
      password: 'a111111',
    })
    if(!result){
      this.printError('login failed')
    }
    
    this.emiter.on('message', (msg) => {
      this.printDebug(msg)
      console.log(`收到消息: ${msg}`);
      resolve(msg); // 收到消息后解析 Promise
    });
    await this.goto('https://qa1-prod.gettr-qa.com/settings/notifications')
  }

  @useBrowser()
  async browser_settings() { 
    const result = await this.login({
      url: 'https://qa13.gettr-qa.com/login?step=sea_login_with_email',
      account: 'post_notify_1',
      password: 'a111111',
    })
    if(!result){
      this.printError('login failed')
    }

    await this.goto('https://qa13.gettr-qa.com/settings/notifications')
    const newflwer=await this.$('div#vertical-tabpanel-4 div:nth-of-type(2) div:nth-of-type(5)')
    if(!newflwer){
      this.printError('new follower item not found')
    }
    await newflwer.click()
    const nFHandler  =await this.$('div#vertical-tabpanel-4 label')
    if(!nFHandler){
      this.printError('new follower switcher not found')
    }
    await this.delay(2000)
    await nFHandler.click()
    this.emiter.emit('message', '这是一个check 信号');
  }
}
