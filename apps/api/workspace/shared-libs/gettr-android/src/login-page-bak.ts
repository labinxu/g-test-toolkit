import { IPage } from './interface/ipage';
import { HomePage } from './home-page';
export class LoginPage1 extends IPage {
  constructor(testcase: any) {
    super(testcase);
  }
  async loginWithUsername(username: string, password: string) {
    await this.useEmailOrUsername();
    await this.page.pause(1000)
    //await this.page.$('~Email / Username').click()
    await this.page.$(
      'android=new UiSelector().resourceId("loginPage_email_tab")'
    ).click()
    await this.inputEmailOrUsername(username)
    await this.inputPassword(password)
    await this.login()
    // this.curEl = await this.page.$('android=new UiSelector().resourceIdMatches(".*emailTab_email_txtField")')
    // await this.curEl.click()
    // await this.curEl.setValue(username)

    // await this.page.pause(500)
    // this.curEl = await this.page.$('android=new UiSelector().resourceIdMatches(".*emailLoginPage_pass_txtField")')
    // await this.curEl.click()
    // await this.curEl.setValue(password)
    // await this.page.$('android=new UiSelector().resourceIdMatches(".*emailLoginPage_send_btn")').click()
    // await this.page.pause(1000)
    return new HomePage(this.testcase);

  }


  /** Input Email or Username */
  async inputEmailOrUsername(username: string) {
    // AUTO-GENERATED-ANDROID: LoginPage.inputEmailOrUsername
    this.logger.debug('LoginPage.inputEmailOrUsername called');
    await this.delay();
    this.curEl = await this.page.$('android=new UiSelector().resourceId("emailTab_email_txtField")');
    await this.curEl?.click();
    await this.curEl?.clearValue?.();
    await this.curEl?.setValue(username);
  }

  /** Input password */
  async inputPassword(passwrod: string) {
    // AUTO-GENERATED-ANDROID: LoginPage.inputPassword
    this.logger.debug('LoginPage.inputPassword called');
    await this.delay();
    this.curEl = await this.page.$('android=new UiSelector().resourceId("emailLoginPage_pass_txtField")');
    await this.curEl?.click();
    await this.curEl?.clearValue?.();
    await this.curEl?.setValue(passwrod);
  }

  /** Login */
  async login() {
    // AUTO-GENERATED-ANDROID: LoginPage.login
    this.logger.debug('LoginPage.login called');
    await this.delay();
    await this.page.$('android=new UiSelector().resourceId("emailLoginPage_send_btn")').then((el) => el?.click());
  }


  /** Use Email or Username */
  async useEmailOrUsername() {
    // AUTO-GENERATED-ANDROID: LoginPage.useEmailOrUsername
    this.logger.debug('LoginPage.useEmailOrUsername called');
    await this.delay();
    await this.page.$('android=new UiSelector().resourceId("loginPage_email_tab")').then((el) => el?.click());
  }


  /** Login with password */
  async loginWithPassword(username: string, password: string) {
    // AUTO-GENERATED-ANDROID: LoginPage.loginWithPassword
    this.logger.debug('LoginPage.loginWithPassword called');
    await this.delay();
  }
}
