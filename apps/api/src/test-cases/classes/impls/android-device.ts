import { CustomLogger } from 'src/logger/logger.custom';
import { AndroidService } from 'src/mobile/android/android.service';

export class AndroidDevice {
  private androidService: AndroidService;
  private clientId: string;
  private logger: CustomLogger;
  private deviceId: string;
  private screenOnKeywords: string;
  private screenPwd: string;
  private swipeCordForScreenOn: string;
  protected exceptCounter = 0;
  protected details: string[] = [];

  constructor(
    clientId: string,
    androidService: AndroidService,
    logger: CustomLogger,
  ) {
    this.clientId = clientId;
    this.logger = logger;
    this.androidService = androidService;
    this.androidService.getDevices();
  }

  async setDeviceId(id: string) {
    const { devices } = await this.androidService.getDevices();
    if (devices.search(id) === -1) {
      throw new Error(`device ${id} not ready`);
    }
    this.logger.sendDebugTo(this.clientId, devices);

    this.deviceId = id;
  }
  setScreenPassword(pwd: string) {
    this.screenPwd = pwd;
  }
  setPowerCheckWords(keywords: string) {
    this.screenOnKeywords = keywords;
  }
  setUnlockSwipeCord(cord: string) {
    this.swipeCordForScreenOn = cord;
  }

  async home() {
    this.logger?.sendDebugTo(this.clientId, 'Returning to home');
    if (!this.androidService) throw new Error('AndroidService not initialized');
    await this.androidService.goHome(this.deviceId);
  }
  async screenOn() {
    this.logger?.sendDebugTo(this.clientId, 'Turning screen on');
    if (!this.androidService) throw new Error('AndroidService not initialized');
    await this.androidService.screenOn(
      this.deviceId,
      this.screenOnKeywords,
      this.screenPwd,
      this.swipeCordForScreenOn,
    );
  }

  async mobileClick(attribute: string, text: string) {
    this.logger?.sendDebugTo(
      this.clientId,
      `Click ${text} attrib: ${attribute}`,
    );
    if (!this.androidService) throw new Error('AndroidService not initialized');
    await this.androidService.click(this.deviceId, attribute, text);
  }
  async dumpxml(toFile: string) {
    this.logger.debug(`Dumping XML for device ${this.deviceId}`);
    try {
      if (!this.androidService)
        throw new Error('AndroidService not initialized');
      await this.androidService.dumpxmlTo(this.deviceId, toFile);
    } catch (err) {
      this.logger?.sendLogTo(this.clientId, 'ERROR: Dump XML failed!');
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
      this.screenOnKeywords,
      this.screenPwd,
      this.swipeCordForScreenOn,
    );
  }
  async mobileScreenshot(toFile: string) {
    if (!this.androidService) throw new Error('AndroidService not initialized');
    await this.androidService.snapscreenTo(this.deviceId, toFile);
  }
}
