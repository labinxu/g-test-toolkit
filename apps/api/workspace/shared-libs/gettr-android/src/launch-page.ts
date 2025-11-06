import { LoginPage } from './login-page';
import { IPage } from './interface/ipage';

export class LaunchPage extends IPage {
    constructor(testcase: any) {
      super(testcase);
    }
    async createInstant(): Promise<void> {
        await this.page.$('~Create Instant Account').click();
    }
    async recoverInstant(): Promise<void> {
        await this.page.$('~Recover Instant Account').click();
    }
    async signUp(): Promise<void> {
        await this.page.$('~Sign up with email, phone, or social media').click()
    }
    async termsConditions(): Promise<void> {
        await this.page.$('~Terms & Conditions').click();
    }
    async loginPage(): Promise<LoginPage> {
        await this.page.$('~Log in').click();
        await this.page.pause(1000);
        return new LoginPage(this.testcase);
    }
}
