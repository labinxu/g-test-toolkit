import { TestCase, Test, withBrowser, useBrowser } from 'core-lib';

import { HomePage } from 'gettr-web-lib';

@Test({ module: 'post' })
@withBrowser({ headless: false, debug: true,domain:"https://stg.gettr.com" })
export class TestDemo extends TestCase {
    private homepage:HomePage;
    async tearUp(){
        this.homepage = new HomePage(this)
        const loginPage = await this.homepage.gotoLoginPage();
        this.homepage = await loginPage.loginWithPassword('stg_lb@mailinator.com','a111111')
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