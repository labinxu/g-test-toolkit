import { IPage } from './interface/ipage';
import { HomePage } from './home-page';

export class LoginPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }
  async loginWithPassword(username: string, password: string) {
    const loginwithpwdbutton = await this.page.$(
      'form div:nth-of-type(3)>span',
    );
    if (!loginwithpwdbutton) {
      this.logger.error(`element: Log in with password not found`);
      return;
    }
    await loginwithpwdbutton?.click();
    await this.delay();
    // username
    await this.page.type('input#email', username);
    await this.page.type('input#password', password);
    await this.page.click('button[type="submit"]');
    await this.delay();

    return new HomePage(this.testcase);
  }
  async post(text: string) {
    const waitNode = await this.page.waitForSelector(
      'div.Toastify__toast-body span',
    );
    if (!waitNode) {
      this.logger.error(`Post ${text} failed!`);
      return;
    }
    const postResult = await waitNode.evaluate((el) => el.textContent);
    this.logger.info(`post content: ${postResult}`);
    this.testcase.assertEqual('Your post was sent.', postResult);
  }
  async gotoLiveStreamPage() {
    await this.delay();
    const createBt = await this.page.$(
      'div.MuiBox-root:nth-of-type(1) >button:nth-of-type(3)',
    );
    if (!createBt) {
      this.logger.error('Create button not found!');
      return;
    }
    await createBt.click();
    await this.delay();
    const buttons = await this.page.$$('div#simple-popper button');
    if (!buttons || buttons.length == 0) {
      this.logger.error('no buttons are found on create panel');
      return;
    }

    const pagePromise = this.testcase.pagePromise();
    await buttons[2].click();
    await this.delay();
    const page = await pagePromise;
    this.logger.debug(`new page ${page.url()}`);
    this.testcase.setPage(page);

    const lvp = new LiveStreamPage(this.testcase);
    await lvp.createLiveStream();
  }
}
