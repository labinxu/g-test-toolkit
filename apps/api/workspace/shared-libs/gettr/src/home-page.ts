import { IPage } from './interface/ipage';

export class HomePage extends IPage {
  constructor(page: any) {
    super(page);
  }
  async gotoLoginPage() {
    const loginButton = await this.page.$(
      '#root > div > div > div > div:nth-of-type(3)> button:nth-of-type(1)',
    );
    await loginButton?.click();
  }
}
