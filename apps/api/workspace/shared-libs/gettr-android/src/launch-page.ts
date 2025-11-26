import { LoginPage } from './login-page';
import { CreateInstantPage } from './create-instant-page';
import { IPage } from './interface/ipage';

export class LaunchPage extends IPage {
    constructor(testcase: any) {
      super(testcase);
    }
    
    async createInstant(): Promise<IPage> {
        await this.page.$('#firstPage_create_btn').click()
        await this.page.pause(500);
        return new CreateInstantPage(this.testcase);
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
        await this.page.pause(2000);
        await this.page.$('~Log in').click()
        await this.page.pause(1000);
        return new LoginPage(this.testcase);
    }

    /**
     * 高层组合步骤：从 Launch 进入登录页并完成用户名密码登录。
     * 等价于：
     *   const login = await launch.loginPage();
     *   await login.useEmailOrUsername();
     *   await login.inputEmailOrUsername(username);
     *   await login.inputPassword(password);
     *   await login.login();
     */
    async loginWithUsername(username: string, password: string) {
        const loginPage = await this.loginPage();
        return await loginPage.loginWithUsername(username, password);
    }
}
