import { TestCase, Test, withBrowser, useBrowser } from 'core-lib';

import {HomePage} from 'gettr-lib';
@Test({ module: 'notification' })
@withBrowser({ headless: false, debug: true })
export class TestDemo extends TestCase {
    async testHelper(){
        this.logger.debug('hello from test logger')
        await this.page().goto('https://gettr.com')
        const hp = new HomePage(this.page())
        await hp.gotoLoginPage();
    }
}