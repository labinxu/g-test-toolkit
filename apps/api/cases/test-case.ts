import { Page } from 'puppeteer';
import { CustomLogger } from 'src/logger/logger.custom';
import { AndroidService } from 'src/mobile/android/android.service';

export class TestCase {
  private logger: CustomLogger | null;
  private p: Page | null;
  private phoneSn: string;
  private screenOnKeyWords: string;
  private screenPwd: string;
  private swipeCordForScreenOn: string;
  private androidService: AndroidService | null;
  async test(): Promise<void> {
    throw new Error('Not implemented');
  }
  constructor() {}
  async run(): Promise<void> {
    throw new Error('Not implemented');
  }
  setLogger(logger: CustomLogger) {
    this.logger = logger;
  }

  setPage(page: Page) {
    this.p = page;
    for (const key of Object.getOwnPropertyNames(Page.prototype)) {
      if (key !== 'constructor' && typeof this.p[key] === 'function') {
        this[key] = this.p[key].bind(this.p);
      }
    }
  }
  page() {
    return this.p;
  }
  print(msg: string) {
    this.logger.sendLogTo(msg);
  }

  async dumpxml() {
    this.print(`dump xml ${this.phoneSn}`);
    try {
      await this.androidService.dumpxmlOnServer(this.phoneSn);
    } catch (err) {
      this.logger.sendLog('ERROR: Dump xml failed!');
    }
  }

  async mobileClick(attribute: string, text: string) {
    await this.androidService.click(this.phoneSn, attribute, text);
  }
  configurePhone(
    sn: string,
    chkwords: string,
    passwoard: string,
    swipeCord: string,
  ) {
    this.phoneSn = sn;
    this.screenOnKeyWords = chkwords;
    this.screenPwd = passwoard;
    this.swipeCordForScreenOn = swipeCord;
  }
  async screenOn() {
    await this.androidService.screenOn(
      this.phoneSn,
      this.screenOnKeyWords,
      this.screenPwd,
      this.swipeCordForScreenOn,
    );
  }
  setAndroidService(service: AndroidService) {
    this.androidService = service;
  }
}
const __testCaseClasses: any[] = [];

export function Regist(): ClassDecorator {
  return function (constructor: Function, context?: any) {
    __testCaseClasses.push(constructor);
  } as any;
}
export async function main(
  logger: CustomLogger,
  service?: AndroidService,
  page?: Page,
) {
  for (const Ctor of __testCaseClasses) {
    const instance = new Ctor();
    instance.setLogger(logger);
    page && instance.setPage(page);
    service && instance.setAndroidService(service);
    logger.setContext(Ctor.name);
    //const transport= logger.addLogFileTransports(`${Ctor.name}-${Date.now()}.log`)
    if (typeof instance.run === 'function') {
      await instance.run();
    }
    //await page.close();
    logger.sendLogTo(`Test ${Ctor.name} Complete!`);
    logger.info(`Test ${Ctor.name} Complete!`);
    //logger.removeLogFileTransports(transport)
  }
}
