import { Browser, Page, ElementHandle, executablePath } from "puppeteer";
import puppeteer from "puppeteer-extra"

export class BrowserControl{
  browser: Browser | null;
  async launch(headless=true){
     this.browser = await puppeteer.launch({
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--start-maximized', // 最大化窗口
      ],
    });
    return await this.browser.newPage();
  }
}
