// AUTO-GENERATED: ACTION-CATALOG
import { IPage } from './interface/ipage';
import { HomePage } from './home-page';

export class LoginPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** Click With Password */
  async clickWithPassword() {
    // AUTO-GENERATED: LoginPage.clickWithPassword
    this.logger.debug('LoginPage.clickWithPassword called');
    const el = await this.page.$("form div:nth-of-type(3)>span");
    await el?.click();
    await this.delay();
  }

  /** Input Account */
  async inputAccount(account: string) {
    // AUTO-GENERATED: LoginPage.inputAccount
    this.logger.debug('LoginPage.inputAccount called');
    await this.page.type("input#email", account);
    await this.delay();
  }

  /** Input Password */
  async inputPassword(password: string) {
    // AUTO-GENERATED: LoginPage.inputPassword
    this.logger.debug('LoginPage.inputPassword called');
    await this.page.type("input#password", password);
    await this.delay();
  }

  /** Click Login button */
  async clickLogin() {
    // AUTO-GENERATED: LoginPage.clickLogin
    this.logger.debug('LoginPage.clickLogin called');
    const el = await this.page.$("button[type=\"submit\"]");
    await el?.click();
    await this.delay();
    return new HomePage(this.testcase);
  }

  /** Login With Account */
  async loginAccount(account: string, password: string) {
    // AUTO-GENERATED: LoginPage.loginAccount
    this.logger.debug('LoginPage.loginAccount called');
    await this.clickWithPassword();
    await this.delay();
    await this.inputAccount(account);
    await this.delay();
    await this.inputPassword(password);
    await this.delay();
    await this.clickLogin();
    await this.delay();
    return new HomePage(this.testcase);
  }
}
