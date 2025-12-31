// AUTO-GENERATED: ACTION-CATALOG
import { IPage } from './interface/ipage';

export class FlameStreamPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** Click Create New Channel */
  async clickCreateNewChannel() {
    // AUTO-GENERATED: FlameStreamPage.clickCreateNewChannel
    this.logger.debug('FlameStreamPage.clickCreateNewChannel called');
    const el = await this.page.$("div#root >div > button");
    await el?.click();
    await this.delay();
  }

  /** Enter Stream Title */
  async enterStreamTitle(title: string) {
    // AUTO-GENERATED: FlameStreamPage.enterStreamTitle
    this.logger.debug('FlameStreamPage.enterStreamTitle called');
    await this.page.type("input[placeholder=\"Enter stream title\"]", title);
    await this.delay();
  }

  /** Enter Description */
  async enterDescription() {
    // AUTO-GENERATED: FlameStreamPage.enterDescription
    this.logger.debug('FlameStreamPage.enterDescription called');
    const el = await this.page.$("textarea[placeholder=\"Enter description\"]");
    await el?.click();
    await this.delay();
  }

  /** Click Select Location */
  async clickSelectLocation() {
    // AUTO-GENERATED: FlameStreamPage.clickSelectLocation
    this.logger.debug('FlameStreamPage.clickSelectLocation called');
    const el = await this.page.$("div.space-y-2:nth-child(4) > button:nth-child(3)");
    await el?.click();
    await this.delay();
  }

  /** Select US */
  async selectUS() {
    // AUTO-GENERATED: FlameStreamPage.selectUS
    this.logger.debug('FlameStreamPage.selectUS called');
    const el = await this.page.$("option[value=\"US\"]");
    await el?.click();
    await this.delay();
  }

  /** Submit */
  async submit() {
    // AUTO-GENERATED: FlameStreamPage.submit
    this.logger.debug('FlameStreamPage.submit called');
    const el = await this.page.$("button[type=\"submit\"]");
    await el?.click();
    await this.delay();
  }

  /** Click Category */
  async clickCategory() {
    // AUTO-GENERATED: FlameStreamPage.clickCategory
    this.logger.debug('FlameStreamPage.clickCategory called');
    const el = await this.page.$("div.space-y-2:nth-child(5) > button:nth-child(3)");
    await el?.click();
    await this.delay();
  }

  /** Select Gaming */
  async selectGaming() {
    // AUTO-GENERATED: FlameStreamPage.selectGaming
    this.logger.debug('FlameStreamPage.selectGaming called');
    const el = await this.page.$("option[value=\"gaming\"]");
    await el?.click();
    await this.delay();
  }

  /** Select Music */
  async selectMusic() {
    // AUTO-GENERATED: FlameStreamPage.selectMusic
    this.logger.debug('FlameStreamPage.selectMusic called');
    const el = await this.page.$("option[value=\"music\"]");
    await el?.click();
    await this.delay();
  }

  /** Select Other */
  async selectOther() {
    // AUTO-GENERATED: FlameStreamPage.selectOther
    this.logger.debug('FlameStreamPage.selectOther called');
    const el = await this.page.$("option[value=\"other\"]");
    await el?.click();
    await this.delay();
  }

  /** Select Sports */
  async selectSports() {
    // AUTO-GENERATED: FlameStreamPage.selectSports
    this.logger.debug('FlameStreamPage.selectSports called');
    const el = await this.page.$("option[value=\"sports\"]");
    await el?.click();
    await this.delay();
  }

  /** Select News */
  async selectNews() {
    // AUTO-GENERATED: FlameStreamPage.selectNews
    this.logger.debug('FlameStreamPage.selectNews called');
    const el = await this.page.$("option[value=\"news\"]");
    await el?.click();
    await this.delay();
  }

  /** Select Education */
  async selectEducation() {
    // AUTO-GENERATED: FlameStreamPage.selectEducation
    this.logger.debug('FlameStreamPage.selectEducation called');
    const el = await this.page.$("option[value=\"education\"]");
    await el?.click();
    await this.delay();
  }

  /** Select JP */
  async selectJP() {
    // AUTO-GENERATED: FlameStreamPage.selectJP
    this.logger.debug('FlameStreamPage.selectJP called');
    const el = await this.page.$("option[value=\"JP\"]");
    await el?.click();
    await this.delay();
  }

  /** Start broadcasting */
  async clickStartBroadcasting() {
    // AUTO-GENERATED: FlameStreamPage.clickStartBroadcasting
    this.logger.debug('FlameStreamPage.clickStartBroadcasting called');
    const el = await this.page.$("button[type=\"submit\"]");
    await el?.click();
    await this.delay();
  }
}
