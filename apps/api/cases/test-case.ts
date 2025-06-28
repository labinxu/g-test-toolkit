import { NotFoundException } from '@nestjs/common';
import { Page } from 'puppeteer';
import { CustomLogger } from 'src/logger/logger.custom';
import { AndroidService } from 'src/mobile/android/android.service';
export class TestCase {
  private logger: CustomLogger | null;
  private p: Page | null;
  private deviceId: string;
  private screenOnKeyWords: string;
  private screenPwd: string;
  private swipeCordForScreenOn: string;
  private androidService: AndroidService | null;
  private clientId: string;
  private sleep: (ms: number) => Promise<void>;
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
  setSleep(sleep: (ms: number) => Promise<void>) {
    this.sleep = sleep;
  }
  setClientId(clientId: string) {
    this.clientId = clientId;
  }
  async delay(ms: number): Promise<void> {
    return await this.sleep(ms);
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
  async scrollDown(): Promise<void> {
    await this.p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
  async scrollTop(): Promise<void> {
    await this.p.evaluate(() => window.scrollTo(0, 0));
  }
  print(msg: string) {
    this.logger.sendLogTo(this.clientId, msg);
  }
  printDebug(message: string) {
    this.logger.sendDebugTo(this.clientId, message);
  }
  printInfo(message: string) {
    this.logger.sendInfoTo(this.clientId, message);
    this.logger.info(message);
  }
  printError(message: string) {
    this.logger.sendErrorTo(this.clientId, message);
  }
  printWarn(message: string) {
    this.logger.sendWarnTo(this.clientId, message);
  }
  async dumpxml() {
    this.print(`dump xml ${this.deviceId}`);
  }
  async mobileClick(attribute: string, text: string) {
    this.logger.sendDebugTo(
      this.clientId,
      `click ${text} attrib: ${attribute}`,
    );
    await this.androidService.click(this.deviceId, attribute, text);
  }
  async exceptIncludesNotifyText(exceptText: string) {
    const result = await this.androidService.hasNotifIncludesText(
      this.deviceId,
      exceptText,
    );
    if (!result) {
      throw new NotFoundException(`Notif Text not include ${exceptText}`);
    }
    return true;
  }
  async clearAllNotifications() {
    this.logger.sendDebugTo(this.clientId, 'clear all notifications');
    await this.androidService.clearAllNotif(
      this.deviceId,
      this.screenOnKeyWords,
      this.screenPwd,
      this.swipeCordForScreenOn,
    );
  }
  async home() {
    this.logger.sendDebugTo(this.clientId, 'back to home');
    await this.androidService.goHome(this.deviceId);
  }
  configurePhone(
    sn: string,
    chkwords: string,
    passwoard: string,
    swipeCord: string,
  ) {
    this.deviceId = sn;
    this.screenOnKeyWords = chkwords;
    this.screenPwd = passwoard;
    this.swipeCordForScreenOn = swipeCord;
  }
  async screenOn() {
    this.logger.sendDebugTo(this.clientId, 'screen on ');
    await this.androidService.screenOn(
      this.deviceId,
      this.screenOnKeyWords,
      this.screenPwd,
      this.swipeCordForScreenOn,
    );
  }
  setAndroidService(service: AndroidService) {
    this.androidService = service;
  }
  async takeSnapshot() {}
}
const __testCaseClasses: any[] = [];

export function Regist(): ClassDecorator {
  return function (constructor: Function, context?: any) {
    __testCaseClasses.push(constructor);
  } as any;
}
export async function main(
  clientId: string,
  logger: CustomLogger,
  sleep: (ms: number) => Promise<void>,
  service?: AndroidService,
  page?: Page,
) {
  for (const Ctor of __testCaseClasses) {
    const instance = new Ctor();
    instance.setLogger(logger);
    instance.setClientId(clientId);
    page && instance.setPage(page);
    instance.setSleep(sleep);
    service && instance.setAndroidService(service);
    logger.setContext(Ctor.name);
    //const transport= logger.addLogFileTransports(`${Ctor.name}-${Date.now()}.log`)
    try {
      if (typeof instance.run === 'function') {
        await instance.run();
      }
    } catch (err) {
      console.log(err);
    }
    //await page.close();
    logger.info(`Test ${Ctor.name} Complete!`);
    //logger.removeLogFileTransports(transport)
  }
  logger.sendExitTo(clientId);
}
