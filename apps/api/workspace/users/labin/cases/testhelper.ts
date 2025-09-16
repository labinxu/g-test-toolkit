import { TestCase, Test, withBrowser, useBrowser } from 'core-lib';

import {HomePage} from 'gettr-lib';
@Test({ module: 'notification' })
export class TestDemo extends TestCase {
    async testHelper(){
        this.logger.debug('hello from test logger')
    }
}