import { Page } from 'puppeteer';
export class IPage {
  page: Page;
  async goto(url: string) {
    return this;
  }
  constructor(page: Page) {
    this.page = page;
  }
}
