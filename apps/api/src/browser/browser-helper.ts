import { Browser } from 'puppeteer';
import puppeteerExra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteer from 'puppeteer';
import { CustomLogger } from 'src/logger/logger.custom';
export { Browser };
puppeteerExra.use(StealthPlugin());

export class BrowserHelper {
  private broweres: Browser[];
  public newPagePromise: any;
  async newBrowser({
    logger = null,
    headless = false,
    timeout = 60000,
    domain,
    retry,
  }: {
    logger: CustomLogger;
    headless: boolean;
    timeout: number;
    domain?: string;
    retry?: number;
  }) {
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
        '--disable-sync', // 禁用同步
        '--no-zygote', // 禁用 Zygote 进程
        '--disable-translate', // 禁用翻译
        '--no-first-run', // 跳过首次运行
        '--disable-webrtc', // 完全禁用 WebRTC（如果网站使用 WebRTC 触发提示）
        '--window-size=1940,1230',
        '--disable-features=VizDisplayCompositor', // 禁用合成器（可选，避免图形相关提示）
        '--disable-bluetooth',
        '--disable-webusb',
        '--disable-features=WebBluetooth,WebUSB',
        '--use-fake-ui-for-media-stream',
      ],
    });
    // 等待新标签页的 Promise

    const pages = await bs.pages();
    const page = pages[0];
    const context = bs.defaultBrowserContext();
    // fixed popup permission dialog
    domain && (await context.overridePermissions(domain, []));
    page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    );
    await page.setViewport({
      width: 1920, // 宽度，例如 1920px
      height: 1080, // 高度，例如 1080px
      deviceScaleFactor: 1, // 缩放比例，1 为正常比例
      isMobile: false,
    });
    const delay = async (ms?: number) => {
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      await sleep(ms);
    };

    let retry_ = retry;
    while (retry_ > 0) {
      try {
        logger?.debug(`try ${retry_} time to ${domain}`);
        domain &&
          (await page.goto(domain, { waitUntil: 'networkidle2', timeout }));
        break;
      } catch (_err) {
        retry_ -= 1;
        await delay(2000);
      }
    }
    if (retry_ === 0) {
      throw new Error(`Open ${domain} failed`);
    }
    return { bs, page };
  }
  async close() {
    for (const bs of this.broweres) {
      try {
        await bs.close();
      } catch (_err) {
        continue;
      }
    }
  }
}
