import { IPage } from './interface/ipage';
import { LiveStreamPage } from './livestream-page';
import { LoginPage } from './login-page';
import { ProfilePage } from './profile-page';

export class HomePage extends IPage {
  constructor(instance: any) {
    super(instance);
  }
  async gotoLoginPage() {
    const loginButton = await this.page.$(
      '#root > div > div > div > div:nth-of-type(3)> button:nth-of-type(1)',
    );
    await loginButton?.click();
    await this.delay();
    return new LoginPage(this.testcase);
  }

  async gotoSignUpPage() {
    const signupButton = await this.page.$(
      '#root > div > div > div > div:nth-of-type(3)> button:nth-of-type(2)',
    );
    await signupButton?.click();
  }
  async gotoProfilePage() {
    const userMenuTrigger = await this.page.$('div.user-menu-trigger');
    if (!userMenuTrigger) {
      this.logger.error(`User menu button can't found!`);
      return;
    }
    await userMenuTrigger.click();
    await this.delay();
    const profileButton = await this.page.waitForSelector(
      '#user-menu > div.MuiPaper-root.MuiPopover-paper.dropdownContent_recover.MuiPaper-elevation8.MuiPaper-rounded > div:nth-child(2) > button',
    );
    if (!profileButton) {
      this.logger.error('profile button not found');
      return;
    }
    await profileButton.click();
    this.delay();
    return new ProfilePage(this.testcase);
  }
  async post(text: string) {
    this.logger.debug(`post ${text}`);
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
    await buttons[0].click();
    await this.delay();
    await this.page.type('div.post-preview-box div.empty-space', text);
    await this.delay();
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

class LoginPage extends IPage {
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
