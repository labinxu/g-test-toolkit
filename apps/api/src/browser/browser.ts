import { Browser } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CustomLogger } from 'src/logger/logger.custom';
import UserPreferencesPlugin from 'puppeteer-extra-plugin-user-preferences';
export { Browser };
puppeteer.use(StealthPlugin());
puppeteer.use(
  UserPreferencesPlugin({
    userPrefs: {
      // 关闭图片自动加载
      // 'profile.default_content_setting_values.images': 2,
      // 设置默认下载目录
      //'download.default_directory': '/tmp/my-downloads',
      // 设置浏览器语言
      // 'intl.accept_languages': 'zh-CN,zh,en',
    },
  }),
);

export class BrowserControl {
  private browser: Browser | null;
  private logger: CustomLogger;
  constructor(logger: CustomLogger) {
    this.logger = logger;
  }
  async launch({ headless = false }: { headless: boolean }) {
    this.browser = await puppeteer.launch({
      headless: headless,
      devtools: false,
      args: [
        //'--window-size=800,600',
        '--no-sandbox',
        '--disable-features=BlockThirdPartyCookies',
        // '--start-maximized',
      ],
      // args: [
      //   '--no-sandbox',
      //   '--disable-gpu',
      //   '--disable-setuid-sandbox',
      //   '--disable-infobars',
      //   '--start-maximized', // 最大化窗口
      // ],
    });
    const page = await this.browser.newPage();
    // await page.setViewport({
    //   width: 1920, // 宽度，例如 1920px
    //   height: 1080, // 高度，例如 1080px
    //   deviceScaleFactor: 1, // 缩放比例，1 为正常比例
    // });
    // page.setViewport({ width: 800, height: 600 });
    return page;
  }
  async closeBrowser() {
    if (this.browser) {
      this.logger.debug('close browser');
      await this.browser.close();
    }
  }
}
