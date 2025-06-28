import { TestCase, Test } from 'test-case';
@Test()
class MyTest extends TestCase {
  async run() {
    this.print('logger test');
    await this.delay(2000);
    this.print('after 2 sceconds');
  }
}
