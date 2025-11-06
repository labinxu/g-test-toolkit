import { TestCase, Test, withBrowser, useBrowser } from 'core-lib';

import {HomePage} from 'gettr-lib';
@Test({ module: 'post' })
@withBrowser({ headless: false, debug: true,domain:"https://qa4.gettr-qa.com" })
export class TestDemo extends TestCase {
    private homepage:HomePage;
    async tearUp(){
        this.homepage = new HomePage(this)
        const loginPage = await this.homepage.gotoLoginPage();
        this.homepage = await loginPage.loginWithPassword('qa4_lb','a111111')
    }
    async test_post_text(){
        let counter = 200;
        while(counter>0){
            await this.homepage.post(`post ${counter}`);
            counter -= 1;
            await this.homepage.delay();
        }
    }
}