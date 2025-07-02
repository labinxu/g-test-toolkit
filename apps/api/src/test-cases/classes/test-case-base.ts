import { Page } from 'puppeteer';
import { CustomLogger } from 'src/logger/logger.custom';
import { AndroidService } from 'src/mobile/android/android.service';
import { ITestBase } from 'src/test-cases/interfaces/ITestBase';
import { WebPage } from './impls/web-page';
import { LoggerService } from 'src/logger/logger.service';
import { AndroidDevice } from './impls/android-device';

export class TestCase implements ITestBase {
  protected details: string[] = [];
  protected logs: string[] = [];
  protected logger: CustomLogger | null = null;
  protected p: WebPage | null = null;
  protected androidDevice: AndroidDevice | null = null;
  protected deviceId = '';
  protected screenOnKeyWords = '';
  protected screenPwd = '';
  protected swipeCordForScreenOn = '';
  protected androidService: AndroidService | null = null;
  protected loggerService: LoggerService | null = null;
  protected clientId = '';
  protected workspace = '';
  protected reportData: Record<string, any> = {};
  protected exceptCounter = 0;

  setName(name: string) {
    this.reportData['caseName'] = name;
  }

  setWorkspace(wks: string) {
    this.workspace = wks;
  }
  setLoggerService(loggerService: LoggerService) {
    this.loggerService = loggerService;
    this.logger = loggerService.createLogger('TestCase');
  }
  async tearUp() {
    this.reportData['startTime'] = Date.now();
  }
  async tearDown() {
    this.reportData['endTime'] = Date.now();
    this.reportData['duration'] =
      this.reportData.endTime - this.reportData.startTime;
    this.reportData['logs'] = this.logs;
    this.reportData['details'] = this.details;
    this.reportData.exceptCounter = this.exceptCounter;
  }

  setClientId(clientId: string) {
    this.clientId = clientId;
  }
  appendLog(log: string): void {
    this.logs.push(log);
  }
  getReportData() {
    return this.reportData;
  }

  setPage(page: Page) {
    const logger = this.loggerService.createLogger('WebPage');
    this.p = new WebPage(this.clientId, page, logger);
    // load the webpage member functions.
    for (const key of Object.getOwnPropertyNames(WebPage.prototype)) {
      if (key !== 'constructor' && typeof this.p[key] === 'function') {
        this[key] = this.p[key].bind(this.p);
      }
    }
  }
  setAndroidService(service: AndroidService) {
    this.androidService = service;
    this.androidDevice = new AndroidDevice(
      this.clientId,
      this.androidService,
      this.loggerService.createLogger('AndroidDevice'),
    );

    // load the webpage member functions.
    for (const key of Object.getOwnPropertyNames(AndroidDevice.prototype)) {
      if (
        key !== 'constructor' &&
        typeof this.androidDevice[key] === 'function'
      ) {
        this[key] = this.androidDevice[key].bind(this.androidDevice);
      }
    }
  }

  page() {
    return this.p;
  }
  print(msg: string) {
    this.logger?.sendLogTo(this.clientId, msg);
  }
  printDebug(message: string) {
    this.logger?.sendDebugTo(this.clientId, message);
  }
  printInfo(message: string) {
    this.logger?.sendInfoTo(this.clientId, message);
    this.logger?.info(message);
  }
  printError(message: string) {
    this.logger?.sendErrorTo(this.clientId, message);
  }
  printWarn(message: string) {
    this.logger?.sendWarnTo(this.clientId, message);
  }
  exceptEqual(except: any, actual: any) {
    this.exceptCounter += 1;
    if (except === actual) {
      this.details.push(
        `Input: ${except} === ${actual}\nExpected: ${except}\nActual: ${actual}\nResult: Passed`,
      );
    } else {
      this.details.push(
        `Input: ${except} === ${actual}\nExpected: ${except}\nActual: ${actual}\nResult: Failed`,
      );
      throw new Error(`Error: Expected ${except}, got ${actual}`);
    }
  }
  exceptNotNull(except: any) {
    this.exceptCounter += 1;
    if (except) {
      this.details.push(
        `Input: ${except} \nExpected: not null \nActual: not null\nResult: Passed`,
      );
    } else {
      this.details.push(
        `Input: ${except} \nExpected: not null \nActual: is null \nResult: Failed`,
      );
      throw new Error(`Error: Expected ${except} is null `);
    }
  }

  configureDevice(
    sn: string,
    keywords: string,
    password: string,
    swipeCord: string,
  ) {
    if (!this.androidDevice) {
      this.logger.sendErrorTo(this.clientId, 'Device not initialized');
      return;
    }
    this.androidDevice.setDeviceId(sn);
    this.androidDevice.setPowerCheckWords(keywords);
    this.androidDevice.setScreenPassword(password);
    this.androidDevice.setUnlockSwipeCord(swipeCord);
  }
  async delay(ms: number) {
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    await sleep(ms);
  }
}
