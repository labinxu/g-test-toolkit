import { TestCase, Test, withBrowser, useBrowser } from 'core-lib';

import {HomePage,ProfilePage} from 'gettr-lib';
@Test({ module: 'post' })
@withBrowser({ headless: false, debug: true,domain:"https://qa4.gettr-qa.com" })
export class TestDemo extends TestCase {
    private homepage:HomePage;
    private profilePage : ProfilePage;
    async tearUp(){
        this.homepage = new HomePage(this)
        const loginPage = await this.homepage.gotoLoginPage();
        this.homepage = await loginPage.loginWithPassword('qa4_lb','a111111')
        this.profilePage = await this.homepage.gotoProfilePage();
    }
    async test_post_delete(){
        await this.profilePage.deleteTopPost()
    }
}