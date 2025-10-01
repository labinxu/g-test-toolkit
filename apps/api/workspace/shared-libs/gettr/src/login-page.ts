import { IPage } from './interface/ipage';
import { HomePage } from './home-page';

export class LoginPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }
  async loginWithPassword(username: string, password: string) {
    const loginwithpwdbutton = await this.page.waitForSelector(
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
