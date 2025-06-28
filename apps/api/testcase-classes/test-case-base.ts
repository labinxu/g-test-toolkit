import { Page } from 'puppeteer';
import { CustomLogger } from 'src/logger/logger.custom';
import { AndroidService } from 'src/mobile/android/android.service';
import { ITestBase } from 'src/test-cases/interfaces/ITestBase';

export class TestCase implements ITestBase {
  protected details: string[] = [];
  protected logs: string[] = [];
  protected logger: CustomLogger | null = null;
  protected p: Page | null = null;
  protected deviceId = '';
  protected screenOnKeyWords = '';
  protected screenPwd = '';
  protected swipeCordForScreenOn = '';
  protected androidService: AndroidService | null = null;
  protected clientId = '';
  protected workspace = '';
  protected sleep: (ms: number) => Promise<void> = async () => {};
  protected reportData: Record<string, any> = {};
  protected exceptCounter = 0;

  setName(name: string) {
    this.reportData['caseName'] = name;
  }

  setWorkspace(wks: string) {
    this.workspace = wks;
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
  setLogger(logger: CustomLogger) {
    this.logger = logger;
  }
  setSleep(sleep: (ms: number) => Promise<void>) {
    this.sleep = sleep;
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
  async delay(ms: number) {
    await this.sleep(ms);
  }
  setPage(page: Page) {
    this.p = page;
  }
  page() {
    return this.p;
  }
  async goto(url: string) {
    try {
      if (!this.p) throw new Error('Page not initialized');
      await this.p.goto(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger?.sendErrorTo(this.clientId, msg);
      await this.pageScreenshot();
      throw err;
    }
  }
  async scrollDown() {
    if (!this.p) throw new Error('Page not initialized');
    await this.p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
  async scrollTop() {
    if (!this.p) throw new Error('Page not initialized');
    await this.p.evaluate(() => window.scrollTo(0, 0));
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
  async dumpxml() {
    this.print(`Dumping XML for device ${this.deviceId}`);
    try {
      if (!this.androidService)
        throw new Error('AndroidService not initialized');
      await this.androidService.dumpxmlTo(this.deviceId, this.workspace);
    } catch (err) {
      this.logger?.sendLogTo(this.clientId, 'ERROR: Dump XML failed!');
    }
  }
  async mobileClick(attribute: string, text: string) {
    this.logger?.sendDebugTo(
      this.clientId,
      `Click ${text} attrib: ${attribute}`,
    );
    if (!this.androidService) throw new Error('AndroidService not initialized');
    await this.androidService.click(this.deviceId, attribute, text);
  }
  async exceptEqual(except: any, actual: any) {
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
  async exceptIncludesNotifyText(exceptText: string) {
    this.exceptCounter += 1;
    if (!this.androidService) throw new Error('AndroidService not initialized');
    const result = await this.androidService.hasNotifIncludesText(
      this.deviceId,
      exceptText,
    );
    if (!result) {
      this.details.push(
        `Expected: ${exceptText}\nActual: Not found\nResult: Failed`,
      );
      throw new Error(`Notification text does not include ${exceptText}`);
    }
    this.details.push(`Expected: ${exceptText}\nActual: Found\nResult: Passed`);
  }
  async clearAllNotifications() {
    this.logger?.sendDebugTo(this.clientId, 'Clearing all notifications');
    if (!this.androidService) throw new Error('AndroidService not initialized');
    await this.androidService.clearAllNotif(
      this.deviceId,
      this.screenOnKeyWords,
      this.screenPwd,
      this.swipeCordForScreenOn,
    );
  }
  async home() {
    this.logger?.sendDebugTo(this.clientId, 'Returning to home');
    if (!this.androidService) throw new Error('AndroidService not initialized');
    await this.androidService.goHome(this.deviceId);
  }
  configurePhone(
    sn: string,
    chkwords: string,
    password: string,
    swipeCord: string,
  ) {
    this.deviceId = sn;
    this.screenOnKeyWords = chkwords;
    this.screenPwd = password;
    this.swipeCordForScreenOn = swipeCord;
  }
  async screenOn() {
    this.logger?.sendDebugTo(this.clientId, 'Turning screen on');
    if (!this.androidService) throw new Error('AndroidService not initialized');
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
  async mobileScreenshot() {
    if (!this.androidService) throw new Error('AndroidService not initialized');
    await this.androidService.snapscreenTo(
      this.deviceId,
      `${this.workspace}/imgs/${this.deviceId}-${Date.now()}.png`,
    );
  }
  async pageScreenshot() {
    if (!this.p) throw new Error('Page not initialized');
    await this.p.screenshot({
      path: `${this.workspace}/imgs/${this.deviceId}-${Date.now()}.png`,
    });
  }
}
