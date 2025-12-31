// AUTO-GENERATED: ACTION-CATALOG
import { IPage } from './interface/ipage';
import { FlamePage } from './flame-page';

export class LiveHostPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** Multi Guest */
  async clickMultiGuest() {
    // AUTO-GENERATED: LiveHostPage.clickMultiGuest
    this.logger.debug('LiveHostPage.clickMultiGuest called');
    const el = await this.page.$("div[aria-label=\"Host a multi-guest livestream from your webcam in Live Studio (Beta).\"]");
    await el?.click();
    await this.delay();
    return new FlamePage(this.testcase);
  }
}
