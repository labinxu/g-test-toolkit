import { TestCase, Test ,WithBrowser} from 'test-case';
@Test()
@WithBrowser({headless:true})
class MyTest extends TestCase {
  async test_case1() {
    this.setWorkspace('aa');
    await this.delay(2000)
    this.print('after 2 sceconds');
  }
  async test_case2(){
    await this.exceptEqual(2,2)
  }
  async test_case3(){
    await this.exceptEqual(2,12)
  }
}
