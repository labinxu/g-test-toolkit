import { Page } from 'puppeteer'
import { CustomLogger } from 'src/logger/logger.custom'
import { AndroidService } from 'src/mobile/android/android.service'
import { ITestBase } from 'src/test-cases/interfaces/ITestBase'
import { WebPage } from './impls/web-page'
import { LoggerService } from 'src/logger/logger.service'
import { AndroidDevice } from './impls/android-device'
import { EventEmitter } from 'events'

export class TestCase implements ITestBase {
  protected p: WebPage | null = null
  protected androidDevice: AndroidDevice | null = null
  protected deviceId = ''
  protected screenOnKeyWords = ''
  protected screenPwd = ''
  protected swipeCordForScreenOn = ''
  protected androidService: AndroidService | null = null
  protected reportData: Record<string, any> = {}
  protected logger: CustomLogger | null = null
  private sharedState: {
    clientId?: string
    workspace?: string
    loggerService?: LoggerService
    logs?: string[]
    details?: string[]
    exceptCounter?: number
    emiter: EventEmitter
  }
  constructor() {
    const emiter = new EventEmitter()
    this.sharedState = {
      clientId: '',
      workspace: '',
      logs: [],
      loggerService: null,
      details: [],
      exceptCounter: 0,
      emiter: emiter,
    }
    emiter.on('event', (msg) => this.eventHandler(msg))
  }
  async eventHandler(event: any) {
    this.printError('eventHandler not implement')
  }
  get emiter() {
    return this.sharedState.emiter
  }
  get exceptCounter() {
    return this.sharedState.exceptCounter
  }
  get details() {
    return this.sharedState.details
  }
  setName(name: string) {
    this.reportData['caseName'] = name
  }
  setWorkspace(wks: string) {
    this.sharedState.workspace = wks
  }
  get loggerService() {
    return this.sharedState.loggerService
  }
  get workspace() {
    console.log('get workspace', this.sharedState.workspace)
    return this.sharedState.workspace
  }
  get clientId() {
    return this.sharedState.clientId
  }
  setLoggerService(loggerService: LoggerService) {
    this.logger = loggerService.createLogger('TestCase')
    this.sharedState.loggerService = loggerService
  }
  setLogger(logger: CustomLogger) {
    this.logger = logger
  }
  async tearUp() {
    this.reportData['startTime'] = Date.now()
  }
  async tearDown() {
    this.reportData['endTime'] = Date.now()
    this.reportData['duration'] = this.reportData.endTime - this.reportData.startTime
    this.reportData['logs'] = this.logs
    this.reportData['details'] = this.details
    this.reportData.exceptCounter = this.exceptCounter
  }

  setClientId(clientId: string) {
    this.sharedState.clientId = clientId
  }
  appendLog(log: string): void {
    this.logs.push(log)
  }
  get logs() {
    return this.sharedState.logs
  }
  getReportData() {
    return this.reportData
  }
  setPage(page: Page) {
    const logger = this.loggerService.createLogger('WebPage')
    this.logger.sendDebugTo(this.clientId, 'setpage')
    this.p = new WebPage(this.clientId, page, logger)
    // load the webpage member functions.
    for (const key of Object.getOwnPropertyNames(WebPage.prototype)) {
      if (key !== 'constructor' && typeof this.p[key] === 'function') {
        this[key] = this.p[key].bind(this.p)
      }
    }
  }
  setAndroidService(service: AndroidService) {
    this.logger.sendDebugTo(this.clientId, 'init android service')
    this.androidService = service
  }

  page() {
    return this.p
  }
  print(msg: string) {
    this.logs.push(this.logger?.format('', msg))
    this.logger?.sendLogTo(this.clientId, msg)
  }
  printDebug(message: string) {
    this.logs.push(this.logger?.format('debug', message))
    this.logger?.sendDebugTo(this.clientId, message)
  }
  printInfo(message: string) {
    this.logs.push(this.logger?.format('', message))
    this.logger?.sendInfoTo(this.clientId, message)
    this.logger?.info(message)
  }
  printError(message: string) {
    this.logs.push(this.logger?.format('error', message))
    this.logger?.sendErrorTo(this.clientId, message)
  }
  printWarn(message: string) {
    this.logs.push(this.logger?.format('warn', message))
    this.logger?.sendWarnTo(this.clientId, message)
  }
  exceptEqual(except: any, actual: any, description?: string) {
    this.sharedState.exceptCounter += 1
    if (except === actual) {
      this.details.push(
        `Input: ${except} === ${actual}\nExpected: ${except}\nActual: ${actual}\nResult: Passed\n${description}`
      )
    } else {
      this.details.push(
        `Input: ${except} === ${actual}\nExpected: ${except}\nActual: ${actual}\nResult: Failed\n${description}`
      )
      throw new Error(`Error: Expected ${except}, got ${actual}`)
    }
  }
  exceptNotNull(except: any, description?: string) {
    this.sharedState.exceptCounter += 1
    if (except) {
      this.details.push(
        `Input: ${except} \nExpected: not null \nActual: not null\nResult: Passed\n${description}`
      )
    } else {
      this.details.push(
        `Input: ${except} \nExpected: not null \nActual: is null \nResult: Failed\n${description}`
      )
      throw new Error(`Error: Expected ${except} is null `)
    }
  }

  async configureDevice(sn: string, keywords: string, password: string, swipeCord: string) {
    if (!this.androidDevice) {
      this.androidDevice = new AndroidDevice(
        this.clientId,
        this.androidService,
        this.loggerService.createLogger(`AndroidDevice[${sn}]`)
      )
    }
    try {
      this.logger.sendDebugTo(this.clientId, `config device ${sn}`)
      await this.androidDevice.setDeviceId(sn)
      this.androidDevice.setPowerCheckWords(keywords)
      this.androidDevice.setScreenPassword(password)
      this.androidDevice.setUnlockSwipeCord(swipeCord)
      // load the webpage member functions.
      for (const key of Object.getOwnPropertyNames(AndroidDevice.prototype)) {
        if (key !== 'constructor' && typeof this.androidDevice[key] === 'function') {
          this[key] = this.androidDevice[key].bind(this.androidDevice)
        }
      }
    } catch (err) {
      this.logger.sendErrorTo(this.clientId, `${err}`)
      throw new Error(`${err}`)
    }
  }
  async delay(ms: number) {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    await sleep(ms)
  }

  clone(tag?: string) {
    const cloned = Object.create(Object.getPrototypeOf(this))
    cloned.sharedState = this.sharedState
    tag && cloned.setLogger(this.loggerService.createLogger(tag))

    return cloned
  }
  formatDateTime(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0') // 月份从 0 开始，需 +1
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  async login(options: { url: string; account: string; password: string }) {
    try {
      await this.p.goto(options.url)
      await this.p.waitForNetworkIdle({ concurrency: 4 })
    } catch (err) {
      const error = err as Error
      this.printError(error.message)
      return
    }
    this.p.centerSelector('form.form.notranslate div span')
    // login with password
    const spans = await this.p.$$('form.form.notranslate div span')
    let result = []
    for (const span of spans) {
      const text = await span.evaluate((el) => el.textContent.trim().toLowerCase())
      if (text === 'log in with password') {
        result.push(span)
        break // Stop after clicking the first match
      }
    }
    if (result.length != 1) {
      this.printError(`Not found 'log in with password'`)
      return
    }
    await result[0].click()
    await this.p.type('input#email', options.account) //"bng_labin")
    await this.p.type('input#password', options.password) //'a111111')
    await this.p.click('button[type="submit"]') // Clicking the link will indirectly cause a navigation
    await this.delay(10000)
    const createBt = await this.p.$('div.MuiBox-root:nth-of-type(1) >button:nth-of-type(3)')
    if (!createBt) {
      this.printError('create button not found!')
      return
    }
    return createBt
  }
}
