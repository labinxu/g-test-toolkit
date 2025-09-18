import { Page } from 'puppeteer';
export class IPage {
  protected page: Page;
  async goto(url: string) {
    return await this.page.goto(url);
  }
  constructor(page: Page) {
    console.log('ipage constructor ', page ? 'page opened' : 'no page');
    this.page = page;
  }
}
