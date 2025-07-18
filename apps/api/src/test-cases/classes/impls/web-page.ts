import { CustomLogger } from 'src/logger/logger.custom'
import {
  Page,
  GoToOptions,
  HTTPResponse,
  KeyboardTypeOptions,
  WaitForSelectorOptions,
  ElementHandle,
  NodeFor,
  QueryOptions,
  WaitForNetworkIdleOptions,
  ScreenshotOptions,
  WaitForOptions,
} from 'puppeteer'

export class WebPage {
  private page: Page
  private logger: CustomLogger
  private clientId: string
  constructor(clientId: string, page: Page, logger: CustomLogger) {
    this.clientId = clientId
    this.page = page
    this.logger = logger
  }
  async handleException() {
    const path = `/tmp/web-page-exception-${Date.now()}.png`
    //await this.page.screenshot({ path });
    this.logger.sendInfoTo(this.clientId, `Write page screen to ${path}`)
  }
  async centerSelector(selector: string) {
    const element = await this.$(selector)
    if (element) {
      await element.evaluate((el) =>
        el.scrollIntoView({
          behavior: 'auto',
          block: 'center',
          inline: 'center',
        })
      )
    } else {
      this.logger.sendErrorTo(this.clientId, `${selector} not found!`)
    }
  }
  async screenshot(options?: Readonly<ScreenshotOptions>): Promise<Uint8Array> {
    try {
      return await this.page.screenshot(options)
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, JSON.stringify(err))
    }
  }

  async scrollDown() {
    if (!this.page) throw new Error('Page not initialized')
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  }
  async scrollTop() {
    if (!this.page) throw new Error('Page not initialized')
    await this.page.evaluate(() => window.scrollTo(0, 0))
  }
  async goto(url: string, options?: GoToOptions): Promise<HTTPResponse | null> {
    try {
      if (!this.page) throw new Error('Page not initialized')
      this.logger.debug(`goto ${url}`)
      return await this.page.goto(url, {
        waitUntil: 'networkidle2',
      })
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, `goto ${url} ${err}`)
      await this.handleException()
      throw err
    }
  }
  async type(
    selector: string,
    text: string,
    options?: Readonly<KeyboardTypeOptions>
  ): Promise<void> {
    try {
      this.logger.debug(`type ${text} to ${selector}`)
      await this.page.type(selector, text, options)
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, `${err}`)
      throw err
    }
  }
  async $<Selector extends string>(
    selector: Selector
  ): Promise<ElementHandle<NodeFor<Selector>> | null> {
    try {
      this.logger.debug(`select ${selector}`)
      const handler = await this.page.$(selector)
      return handler
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, JSON.stringify(err))
    }
  }
  async $$<Selector extends string>(
    selector: Selector,
    options?: QueryOptions
  ): Promise<Array<ElementHandle<NodeFor<Selector>>>> {
    try {
      this.logger.debug(`select all ${selector}`)
      const handlers = await this.page.$$(selector, options)
      return handlers
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, JSON.stringify(err))
    }
  }

  async waitForSelector<Selector extends string>(
    selector: Selector,
    options?: WaitForSelectorOptions
  ): Promise<ElementHandle<NodeFor<Selector>> | null> {
    try {
      this.logger.debug(`waitForSelector ${selector}`)
      return await this.page.waitForSelector(selector, options)
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, `waitForSelector: ${err}`)
      throw err
    }
  }
  async reload(options?: WaitForOptions): Promise<HTTPResponse | null> {
    try {
      this.logger.debug('page reload')
      return await this.page.reload(options)
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, `${err}`)
      throw err
    }
  }
  async waitForNetworkIdle(options?: WaitForNetworkIdleOptions): Promise<void> {
    try {
      await this.page.waitForNetworkIdle(options)
    } catch (error) {
      this.logger.sendErrorTo(this.clientId, `waitForNetworkIdle:${error}`)
    }
  }
  async click(selector: string) {
    try {
      return await this.page.click(selector)
      // const response = await Promise.all([
      //   //this.page.waitForNavigation({ waitUntil: 'networkidle2' }), // The promise resolves after navigation has finished
      //   this.page.click(selector), // Clicking the link will indirectly cause a navigation
      // ]);
      // return response;
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, `click: ${err}`)
      throw err
    }
  }
}
