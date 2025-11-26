 import {
    describe,
    it,
    beforeAll,
    afterAll,
    useTestCase,
} from 'core-lib'
import { release_1_73_0 as rel1730}  from 'gettr-android-lib';
import { HomePage,LaunchPage,LoginPage ,LiveStreamPage,} from 'gettr-android-lib';
  describe('Android login flow', () => {
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
      const lp = new rel1730.LoginUsernamePage(tc);

      // const lgp = await lp.loginPage();
      // const hp = await lgp.loginWithUsername('qa_lb','a111111');
      // await hp.remindMeLater()

    })
    it('Verify post', async () => {

    });
    afterAll(async () => {
       
    })
  })