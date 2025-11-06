import { TestCase, Test, withAndroid } from 'core-lib';
import { HomePage } from 'android-lib';

// Install mode example: installs APK before launching.
@Test({ module: 'appium' })
@withAndroid({
  deviceName: 'smatisan',
  udid: '832dc799',
  apk: 'gettr-1.74.3.apk',
  // Disable bring-to-front for install demo
  //bringToFront: false,
})
export class TestAppiumInstallDemo extends TestCase {
  async test_appium() {
    this.logger.debug('appium test case (install mode)');
    const hp = new HomePage(this);
    await hp.gotoLoginPage('qa_lb', 'a111111');
  }
}
