// AUTO-GENERATED: ACTION-CATALOG
import { IPage } from './interface/ipage';
import { FlameStreamPage } from './flamestream-page';

export class FlamePage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** New Stream */
  async clickNewStream() {
    // AUTO-GENERATED: FlamePage.clickNewStream
    this.logger.debug('FlamePage.clickNewStream called');
    const el = await this.page.$("a[href=\"/liveStudio/new-stream\"]");
    await el?.click();
    await this.delay();
    return new FlameStreamPage(this.testcase);
  }
}
