import { Browser } from 'puppeteer';
import puppeteerExra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CustomLogger } from 'src/logger/logger.custom';
import puppeteer from 'puppeteer';
//import UserPreferencesPlugin from 'puppeteer-extra-plugin-user-preferences';

export { Browser };
puppeteerExra.use(StealthPlugin());

// puppeteerExra.use(
//   UserPreferencesPlugin({
//     userPrefs: {
//       // 关闭图片自动加载
//       // 'profile.default_content_setting_values.images': 2,
//       // 设置默认下载目录
//       //'download.default_directory': '/tmp/my-downloads',
//       // 设置浏览器语言
//       // 'intl.accept_languages': 'zh-CN,zh,en',
//     },
//   }),
// );

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
      executablePath:
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-features=BlockThirdPartyCookies',
        '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
        '--disable-features=PrivacySandboxSettings4',
        '--disable-features=TrackingProtection3pcd',
        '--start-maximized',
        '--window-size=1940,1230',
      ],
    });
    const page = await this.browser.newPage();
    page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    );

    await page.setViewport({
      width: 1920, // 宽度，例如 1920px
      height: 1080, // 高度，例如 1080px
      deviceScaleFactor: 1, // 缩放比例，1 为正常比例
      isMobile: false,
    });
    return page;
  }
  async closeBrowser() {
    if (this.browser) {
      this.logger.debug('close browser');
      await this.browser.close();
    }
  }
}
