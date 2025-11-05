import { IPage } from './interface/ipage';
import { HomePage } from './home-page';
export class LoginPage extends IPage {
    constructor(testcase: any) {
      super(testcase);
    }
  async loginWithUsername(username: string, password: string) {
    await this.page.pause(1000)
    await this.page.$('~Email / Username').click()
    const allInputs = await this.page.$$('//android.widget.EditText')
    this.logger.debug(`input number: ${allInputs.length}`)
    await allInputs[1].setValue(username) // 第一个
    await this.page.pause(1000)
    await allInputs[2].click()
    await allInputs[2].setValue(password) // 第二个
    await this.page.pause(500)
    await this.page.$('//android.view.View[@content-desc="Log In" and @clickable="true"]').click()
    await this.page.pause(500)
    return new HomePage(this.testcase);
  }
}
