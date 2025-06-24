import { Browser } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import { CustomLogger } from 'src/logger/logger.custom';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

export class BrowserControl {
  private browser: Browser | null;
  private logger : CustomLogger
  constructor(logger:CustomLogger)
  {this.logger = logger;}
  async launch(headless = false) {
    this.browser = await puppeteer.launch({
      headless: headless,
      // args: [
      //   '--no-sandbox',
      //   '--disable-gpu',
      //   '--disable-setuid-sandbox',
      //   '--disable-infobars',
      //   '--start-maximized', // 最大化窗口
      // ],
    });
    return await this.browser.newPage();
  }
  async closeBrowser() {
    if (this.browser) {
      this.logger.debug('close browser')
      await this.browser.close();
    }
  }
}
