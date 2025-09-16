import { Browser } from 'puppeteer';
import puppeteerExra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteer from 'puppeteer';
export { Browser };
puppeteerExra.use(StealthPlugin());

export class BrowserHelper {
  private broweres: Browser[];

  async newBrowser({ headless = false }: { headless: boolean }) {
    const bs = await puppeteer.launch({
      headless: headless,
      devtools: false,
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
    const page = await bs.newPage();
    page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    );

    await page.setViewport({
      width: 1920, // 宽度，例如 1920px
      height: 1080, // 高度，例如 1080px
      deviceScaleFactor: 1, // 缩放比例，1 为正常比例
      isMobile: false,
    });
    return { bs, page };
  }
  async close() {
    for (const bs of this.broweres) {
      try {
        await bs.close();
      } catch (err) {
        continue;
      }
    }
  }
}
