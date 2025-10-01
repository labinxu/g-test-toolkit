import { TestCase, Test, withBrowser, useBrowser } from 'core-lib';

import { HomePage } from 'gettr-lib';
@Test({ module: 'notification' })
@withBrowser({
  headless: false,
  debug: true,
  domain: 'https://qa10.gettr-qa.com',
})
export class TestDemo extends TestCase {
  private homepage: HomePage;
  tearUp() {
    this.homepage = new HomePage(this);
  }
  async test_post_text() {
    const loginPage = await this.homepage.gotoLoginPage();
    this.homepage = await loginPage.loginWithPassword(
      'live_wenxia',
      '!live_wenxia',
    );
    await this.homepage.post(`post from scripts ${Date.now()}`);
  }
  async test_post_with_pic() {}
}
