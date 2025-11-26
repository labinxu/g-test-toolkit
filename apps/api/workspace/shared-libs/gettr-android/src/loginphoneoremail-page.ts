// AUTO-GENERATED: ACTION-CATALOG-ANDROID
import { IPage } from './interface/ipage';
import { LoginPage } from './login-page';

export class LoginPhoneOrEmailPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。

  /** Email or Username */
  async emailOrUsername() {
    // AUTO-GENERATED-ANDROID: LoginPhoneOrEmailPage.emailOrUsername
    this.logger.debug('LoginPhoneOrEmailPage.emailOrUsername called');
    await this.page.pause(500);
    await this.page.$('android=new UiSelector().resourceId("loginPage_email_tab")').then((el) => el?.click());
    await this.delay();
    return new LoginPage(this.testcase);
  }
}
