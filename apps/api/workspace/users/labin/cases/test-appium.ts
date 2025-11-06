import { TestCase, Test, withAndroid } from 'core-lib';
import { HomePage } from 'gettr-android-lib';

// Launch mode example: ensure the app is pre-installed on device/emulator.
@Test({ module: 'appium' })
@withAndroid({
  deviceName: 'smatisan',
  udid: '832dc799',
  appPackage: 'com.gettr.gettr',
  appActivity: '.MainActivity',
})
export class TestAppiumDemo extends TestCase {
  async test_appium() {
    // this.logger.debug('appium test case (launch mode)');
    const hp = new HomePage(this);
     
    await hp.page.$('~Remind me later').click()
  }
}
