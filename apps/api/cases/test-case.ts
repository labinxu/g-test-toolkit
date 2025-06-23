import { Page } from 'puppeteer';
import { CommandService } from 'src/command/command.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { AndroidService } from 'src/mobile/android/android.service';

export class TestCase {
  private logger: CustomLogger | null;
  private page: Page | null;
  private phoneSn: string;
  private screenOnKeyWords: string;
  private screenPwd: string;
  private swipeCordForScreenOn: string;
  private androidService: AndroidService | null;
  private commandService: CommandService | null;
  private xmlObj: any;
  async test(): Promise<void> {
    throw new Error('Not implemented');
  }
  constructor() {}

  setLogger(logger: CustomLogger) {
    this.logger = logger;
  }

  setPage(page: Page) {
    this.page = page;
  }
  print(msg: string) {
    this.logger.debug(msg);
    this.logger.sendLog(msg);
  }
  async goto(url: string) {
    await this.page.goto(url);
  }
  async dumpxml() {
    try {
      await this.androidService.dumpxmlOnServer(this.phoneSn);
    } catch (err) {
      this.logger.sendLog('ERROR: Dump xml failed!');
    }
  }

  async click(attribute:string,text:string){
    await this.androidService.click(this.phoneSn,attribute,text)
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
  setCommandService(service:CommandService){
    this.commandService = service;
  }
}
const __testCaseClasses: any[] = [];

export function Regist(): ClassDecorator {
  return function (constructor: Function, context?: any) {
    // 装饰器的实现逻辑，比如注册类等
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
    if (typeof instance.test === 'function') {
      await instance.test();
    }
    await page.close();
    logger.debug(`Test ${Ctor.name} Complete!`);
  }
}
