// AUTO-GENERATED: ACTION-CATALOG
import { IPage } from './interface/ipage';

export class LivePage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** Popular Tab */
  async clickPopular() {
    // AUTO-GENERATED: LivePage.clickPopular
    this.logger.debug('LivePage.clickPopular called');
    const el = await this.page.$("div.MuiTabs-flexContainer >a:nth-of-type(1)");
    await el?.click();
    await this.delay();
  }
}
