import { TestCase, Regist } from 'test-case';
@Regist()
class MyTest extends TestCase {
  async test() {
    this.configurePhone('0A171FDD40063C','holding display','125698',"300 900 300 200")
    await this.screenOn();
    await this.dumpxml();
    await this.mobileClick('text','GETTR');
    const page = this.getPage();
    await page.goto('https://qa1-prod.gettr-qa.com/')
    this.print('Test executed');
  }
}
