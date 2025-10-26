import { IPage } from './interface/ipage'
import { LoginPage } from './login-page'
import { ProfilePage } from './profile-page'

export class HomePage extends IPage {
  constructor(instance: any) {
    super(instance)
    this.logger.info('create android homepage')
  }
  async gotoLoginPage() {
    await this.page.$('~Log in').click()
    await this.delay()
    return new LoginPage(this.testcase)
  }

  async gotoSignUpPage() {}
}
