import { TestCase, Test } from 'test-case';
@Test()
class MyTest extends TestCase {
  async test_case1() {
    this.print('logger test');
    this.setWorkspace('aa');
    await this.delay(2000)
    this.print('after 2 sceconds');
  }
  async test_case2(){
    this.print('case2')
    await this.exceptEqual(2,2)
  }
  async test_case3(){
    this.print('case3')
    await this.exceptEqual(2,12)
  }
}
