// AUTO-GENERATED: ACTION-CATALOG
import { IPage } from './interface/ipage';
import { LoginPage } from './login-page';

export class HomePage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** Click Login button */
  async clickLoginButton() {
    // AUTO-GENERATED: HomePage.clickLoginButton
    this.logger.debug('HomePage.clickLoginButton called');
    const el = await this.page.$("[data-testid=\"home_login\"]");
    await el?.click();
    await this.delay();
    return new LoginPage(this.testcase);
  }
}
