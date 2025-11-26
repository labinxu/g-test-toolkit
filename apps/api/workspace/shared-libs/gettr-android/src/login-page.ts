// AUTO-GENERATED: ACTION-CATALOG-ANDROID
import { IPage } from './interface/ipage';

export class LoginPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** Use Email or Username */
  async useEmailOrUsername() {
    // AUTO-GENERATED-ANDROID: LoginPage.useEmailOrUsername
    this.logger.debug('LoginPage.useEmailOrUsername called');
    await this.delay();
    await this.page.$('android=new UiSelector().resourceId("loginPage_email_tab")').then((el) => el?.click());
    await this.delay();
  }

  /** inputEmailOrUsername */
  async inputEmailOrUsername(username: string) {
    // AUTO-GENERATED-ANDROID: LoginPage.inputEmailOrUsername
    this.logger.debug('LoginPage.inputEmailOrUsername called');
    await this.delay();
    this.curEl = await this.page.$('android=new UiSelector().resourceId("emailTab_email_txtField")');
    await this.curEl?.click();
    await this.curEl?.clearValue?.();
    await this.curEl?.setValue(username);
    await this.delay();
  }

  /** inputPassword */
  async inputPassword(password: string) {
    // AUTO-GENERATED-ANDROID: LoginPage.inputPassword
    this.logger.debug('LoginPage.inputPassword called');
    await this.delay();
    this.curEl = await this.page.$('android=new UiSelector().resourceId("emailLoginPage_pass_txtField")');
    await this.curEl?.click();
    await this.curEl?.clearValue?.();
    await this.curEl?.setValue(password);
    await this.delay();
  }

  /** login */
  async login() {
    // AUTO-GENERATED-ANDROID: LoginPage.login
    this.logger.debug('LoginPage.login called');
    await this.delay();
    await this.page.$('android=new UiSelector().resourceId("emailLoginPage_send_btn")').then((el) => el?.click());
    await this.delay();
  }

  /** Login with password */
  async loginWithPassword(username: string, password: string) {
    // AUTO-GENERATED-ANDROID: LoginPage.loginWithPassword
    this.logger.debug('LoginPage.loginWithPassword called');
    await this.delay();
    await this.useEmailOrUsername();
    await this.inputEmailOrUsername(username);
    await this.inputPassword(password);
    await this.login();
    await this.delay();
  }
}
