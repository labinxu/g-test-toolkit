// AUTO-GENERATED: ACTION-CATALOG
import { IPage } from './interface/ipage';
import { HomePage } from './home-page';

export class HomeDemoPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** login with username and password */
  async loginWithPassword(username: string, password: string) {
    // AUTO-GENERATED: HomeDemoPage.loginWithPassword
    this.logger.debug('HomeDemoPage.loginWithPassword called');
    const el = await this.page.$("div.jss2804");
    await el?.click();
    await this.delay();
  }

  /** check login status */
  async verifyLogin() {
    // AUTO-GENERATED: HomeDemoPage.verifyLogin
    this.logger.debug('HomeDemoPage.verifyLogin called');
    const el = await this.page.$("#id-verify");
    this.testcase.assertNotNull(el, 'HomeDemoPage.verifyLogin element');
    await this.delay();
    return new HomePage(this.testcase);
  }
}
