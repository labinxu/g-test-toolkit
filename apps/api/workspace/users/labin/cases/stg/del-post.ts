import { TestCase, Test, withBrowser, useBrowser } from 'core-lib';

import {HomePage,ProfilePage} from 'gettr-lib';
@Test({ module: 'post' })
@withBrowser({ headless: false, debug: true,domain:"https://stg.gettr.com" })
export class TestDemo extends TestCase {
    private homepage:HomePage;
    private profilePage : ProfilePage;
    async tearUp(){
        this.homepage = new HomePage(this)
        const loginPage = await this.homepage.gotoLoginPage();
        this.homepage = await loginPage.loginWithPassword('stg_lb@mailinator.com','a111111')
        this.profilePage = await this.homepage.gotoProfilePage();
    }
    async test_post_delete(){
        let counter = 60;
        while(counter>0){
            await this.profilePage.deleteTopPost()
            counter -= 1;
            await this.profilePage.delay();
        }
        
    }
}