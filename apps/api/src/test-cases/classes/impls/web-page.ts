import {
  Page,
  GoToOptions,
  HTTPResponse,
  KeyboardTypeOptions,
  WaitForSelectorOptions,
} from 'puppeteer';
import { CustomLogger } from 'src/logger/logger.custom';
import {
  ElementHandle,
  NodeFor,
  QueryOptions,
  WaitForNetworkIdleOptions,
  ClickOptions,
  ScreenshotOptions,
} from 'puppeteer';

export class WebPage {
  private page: Page;
  private logger: CustomLogger;
  private clientId: string;
  constructor(clientId: string, page: Page, logger: CustomLogger) {
    this.clientId = clientId;
    this.page = page;
    this.logger = logger;
  }
  async screenshot(options?: Readonly<ScreenshotOptions>): Promise<Uint8Array> {
    try {
      return await this.page.screenshot(options);
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, JSON.stringify(err));
    }
  }

  async scrollDown() {
    if (!this.page) throw new Error('Page not initialized');
    await this.page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight),
    );
  }
  async scrollTop() {
    if (!this.page) throw new Error('Page not initialized');
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }
  async goto(url: string, options?: GoToOptions): Promise<HTTPResponse | null> {
    try {
      if (!this.page) throw new Error('Page not initialized');
      this.logger.debug(`goto ${url}`);
      return await this.page.goto(url, options);
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, JSON.stringify(err));
      throw err;
    }
  }
  async type(
    selector: string,
    text: string,
    options?: Readonly<KeyboardTypeOptions>,
  ): Promise<void> {
    try {
      await this.page.type(selector, text, options);
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, `${err}`);
      throw err;
    }
  }
  async $<Selector extends string>(
    selector: Selector,
  ): Promise<ElementHandle<NodeFor<Selector>> | null> {
    try {
      const handler = await this.page.$(selector);
      return handler;
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, JSON.stringify(err));
    }
  }
  async $$<Selector extends string>(
    selector: Selector,
    options?: QueryOptions,
  ): Promise<Array<ElementHandle<NodeFor<Selector>>>> {
    try {
      const handlers = await this.page.$$(selector, options);
      return handlers;
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, JSON.stringify(err));
    }
  }

  async waitForSelector<Selector extends string>(
    selector: Selector,
    options?: WaitForSelectorOptions,
  ): Promise<ElementHandle<NodeFor<Selector>> | null> {
    try {
      return await this.page.waitForSelector(selector, options);
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, `${err}`);
      throw err;
    }
  }
  async waitForNetworkIdle(options?: WaitForNetworkIdleOptions): Promise<void> {
    try {
      await this.page.waitForNetworkIdle(options);
    } catch (error) {
      this.logger.sendErrorTo(this.clientId, JSON.stringify(error));
    }
  }
  async click(
    selector: string,
    options?: Readonly<ClickOptions>,
  ): Promise<void> {
    try {
      await this.page.click(selector, options);
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, JSON.stringify(err));
    }
  }
}
