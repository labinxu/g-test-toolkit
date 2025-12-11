// AUTO-GENERATED: ACTION-CATALOG
import { IPage } from './interface/ipage';
import { LoginPage } from './login-page';
import { LivePage } from './live-page';

export class HomePage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** Click Login button */
  async clickLoginButton() {
    // AUTO-GENERATED: HomePage.clickLoginButton
    this.logger.debug('HomePage.clickLoginButton called');
    const el = await this.page.$("#root > div > div > div > div:nth-of-type(3)> button:nth-of-type(1)");
    await el?.click();
    await this.delay();
    return new LoginPage(this.testcase);
  }

  /** Click Live Tab */
  async clickLiveTab() {
    // AUTO-GENERATED: HomePage.clickLiveTab
    this.logger.debug('HomePage.clickLiveTab called');
    const el = await this.page.$("a[title=\"Live\"]");
    await el?.click();
    await this.delay();
    return new LivePage(this.testcase);
  }

  /** Go Live Host */
  async goLiveHost() {
    // AUTO-GENERATED: HomePage.goLiveHost
    this.logger.debug('HomePage.goLiveHost called');
    await this.clickCreateMenu();
    await this.delay();
    await this.clickGoLive();
    await this.delay();
  }
}
