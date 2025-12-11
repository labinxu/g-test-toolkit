export class IPage {
  protected testcase: any;
  async goto(url: string) {
    return await this.testcase.page().goto(url);
  }
  constructor(testInstance: any) {
    this.testcase = testInstance;
  }
  async delay(ms?: number) {
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    await sleep(ms ? ms : this.delayTime);
  }
  get delayTime() {
    return this.testcase.delaytime;
  }
  get page() {
    return this.testcase.page;
  }
  get logger() {
    return this.testcase.logger;
  }
  async clickCreateMenu() {
    const createBt = await this.page.$(
      'div.MuiBox-root:nth-of-type(1) >button:nth-of-type(3)',
    );
    if (!createBt) {
      this.logger.error('Create button not found!');
      return;
    }
    await createBt.click();
    await this.delay();
  }
  async clickGoLive() {
    const buttons = await this.page.$$('div#simple-popper button');
    if (!buttons || buttons.length == 0) {
      this.logger.error('no buttons are found on create panel');
      return;
    }
    // 如果点击后会打开新标签页，提前监听新 page，再切换到它
    const newPagePromise =
      typeof this.testcase?.pagePromise === 'function'
        ? (this.testcase.pagePromise() as Promise<any>)
        : null;
    await buttons[2].click();
    if (newPagePromise) {
      try {
        const newPage = await newPagePromise;
        if (newPage) {
          await newPage.bringToFront?.();
          if (typeof this.testcase?.setPage === 'function') {
            this.testcase.setPage(newPage);
          }
        }
      } catch (e) {
        this.logger.error(`failed to switch to new tab: ${String(e)}`);
      }
    }
    await this.delay();
  }
  async clickWriteAPost() {
    const buttons = await this.page.$$('div#simple-popper button');
    if (!buttons || buttons.length == 0) {
      this.logger.error('no buttons are found on create panel');
      return;
    }
    await buttons[0].click();
    await this.delay();
  }
  async writeAPost(text: string) {
    await this.page.type('div.post-preview-box div.empty-space', text);
    await this.delay();
  }
  async clickPost() {
    const postButton = await this.page.$('div.action-bar > button');
    if (!postButton) {
      this.logger.error('post button not found!');
      return;
    }
    await this.delay();
    await postButton.click();
    await this.delay();
  }
}
