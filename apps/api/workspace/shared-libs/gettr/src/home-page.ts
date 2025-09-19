import { IPage } from './interface/ipage';

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
  }
}
