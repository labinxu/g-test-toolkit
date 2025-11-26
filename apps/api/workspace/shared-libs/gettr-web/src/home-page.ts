import { IPage } from './interface/ipage'
import { LoginPage } from './login-page'
import { ProfilePage } from './profile-page'

export class HomePage extends IPage {
  constructor(instance: any) {
    super(instance)
    this.logger.info('create web homepage')
  }
  async gotoLoginPage() {
    const loginButton = await this.page.$(
      '#root > div > div > div > div:nth-of-type(3)> button:nth-of-type(1)'
    )
    await loginButton?.click()
    await this.delay()
    return new LoginPage(this.testcase)
  }

  async gotoSignUpPage() {
    const signupButton = await this.page.$(
      '#root > div > div > div > div:nth-of-type(3)> button:nth-of-type(2)'
    )
    await signupButton?.click()
  }
  async gotoProfilePage() {
    const userMenuTrigger = await this.page.$('div.user-menu-trigger')
    if (!userMenuTrigger) {
      this.logger.error(`User menu button can't found!`)
      return
    }
    await userMenuTrigger.click()
    await this.delay()
    const profileButton = await this.page.waitForSelector(
      '#user-menu > div.MuiPaper-root.MuiPopover-paper.dropdownContent_recover.MuiPaper-elevation8.MuiPaper-rounded > div:nth-child(2) > button'
    )
    if (!profileButton) {
      this.logger.error('profile button not found')
      return
    }
    await profileButton.click()
    this.delay()
    return new ProfilePage(this.testcase)
  }
  async post(text: string) {
    this.logger.debug(`post: ${text}`)
    await this.delay()
    const createBt = await this.page.$('div.MuiBox-root:nth-of-type(1) >button:nth-of-type(3)')
    if (!createBt) {
      this.logger.error('Create button not found!')
      return
    }
    await createBt.click()
    await this.delay()
    const buttons = await this.page.$$('div#simple-popper button')
    if (!buttons || buttons.length == 0) {
      this.logger.error('no buttons are found on create panel')
      return
    }
    await buttons[0].click()
    await this.delay()
    await this.page.type('div.post-preview-box div.empty-space', text)
    await this.delay()
    const postButton = await this.page.$('div.action-bar > button')
    if (!postButton) {
      this.logger.error('post button not found!')
      return
    }
    await this.delay()
    await postButton.click()
    await this.delay()
  }


  /** Signup */
  async signup() {
    this.logger.debug('HomePage.signup called');
    await this.delay();
  }
}
