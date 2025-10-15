import { IPage } from './interface/ipage';

export class LiveStreamPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }
  async createLiveStream() {
    this.logger.debug(`create live stream. ${this.page.url()}`);
    await this.delay();

    const streamKeyViewNode = await this.page.waitForSelector(
      'div.Style_info__trMMI>div>div:nth-of-type(2)>span:nth-of-type(2)',
    );
    if (!streamKeyViewNode) {
      this.logger.error('Stream key view not found');
      return;
    }
    await streamKeyViewNode.click();
    await this.delay();
    const streamKey = await this.page.$eval(
      'div.Style_info__trMMI>div:nth-of-type(1)>div:nth-of-type(2)>span:nth-of-type(1)',
      (el) => el.textContent,
    );
    this.logger.debug(`stream Key: ${streamKey}`);
    const streamURL = await this.page.$eval(
      'div.Style_info__trMMI>div:nth-of-type(2)>div:nth-of-type(2)',
      (el) => el.textContent,
    );
    this.testcase.assertNotNull(streamKey);
    this.logger.debug(`stream URL: ${streamURL}`);
    await fetch(
      `http://localhost:3001/testcase/livestream?clientId=${this.testcase.clientId}`,
    )
      .then((resp) => {
        if (resp.ok) {
          return resp.json();
        }
      })
      .then((data) => {
        this.logger.debug(data.message);
      });
    while(true){
      await this.delay();
    }
    return this;
  }
}
