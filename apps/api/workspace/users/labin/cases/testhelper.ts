import { TestCase, Test, withBrowser, useBrowser } from 'core-lib';

import {HomePage} from 'gettr-lib';
@Test({ module: 'notification' })
@withBrowser({ headless: false, debug: true,domain:"https://qa10.gettr-qa.com" })
export class TestDemo extends TestCase {
    async testHelper(){
        this.logger.debug('hello from test logger')
        await this.page.goto('https://qa10.gettr-qa.com')
        const hp = new HomePage(this)
        const loginPage = await hp.gotoLoginPage();
        const homepage = await loginPage.loginWithPassword('live_wenxia','!live_wenxia')
        await homepage.post('post from scripts2');
    }
}