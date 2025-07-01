import { Browser } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CustomLogger } from 'src/logger/logger.custom';
import UserPreferencesPlugin from 'puppeteer-extra-plugin-user-preferences';
puppeteer.use(StealthPlugin());
puppeteer.use(
  UserPreferencesPlugin({
    userPrefs: {
      // 关闭图片自动加载
      'profile.default_content_setting_values.images': 2,
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
      //args: ['--window-size=800,600'],
      // args: [
      //   '--no-sandbox',
      //   '--disable-gpu',
      //   '--disable-setuid-sandbox',
      //   '--disable-infobars',
      //   '--start-maximized', // 最大化窗口
      // ],
    });
    const page = await this.browser.newPage();
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
