 import {
    describe,
    it,
    beforeAll,
    afterAll,
    useTestCase,
  } from 'core-lib'
import { HomePage,LaunchPage,LoginPage ,LiveStreamPage} from 'gettr-android-lib';
  describe('Android login flow', () => {
    let homepage = null;
    const tc = useTestCase({
      module: 'android-login',
      android: {
       deviceName: 'smatisan',
        udid: '832dc799',
        apk: '1.74.5-251104117.apk',
        // installBehavior: 'install',      // or 'launch'
        // bringToFront: true,
        // appPackage: 'com.gettr.gettr',
        // appActivity: '.MainActivity',
      },
      keepAppOpen: true,
      shareSession: true,
    })

    beforeAll(async () => {
      //await tc.prepareSession?.({ reinstall: true })
    })
     
    it('Verify login', async () => {
      const lp = new LaunchPage(tc);
      const lgp = await lp.loginPage();
      homepage = await lgp.loginWithUsername('qa_lb','a111111');
    })
    it('Remove remind me later', async () => {
      await homepage.remindMeLater()
    });
    afterAll(async () => {
       
    })
  })