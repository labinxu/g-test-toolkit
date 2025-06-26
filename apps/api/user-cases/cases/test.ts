import { TestCase, Regist } from 'test-case';
@Regist()
class MyTest extends TestCase {
  async test() {
    await this.goto('https://qa15.gettr-qa.com/login?step=sea_login_with_email')
    const el = await this.$("form.form.notranslate > div:nth-of-type(3) > span");
    if (el) {
      // do something
      await el.click();
      await this.type('input#email',"labin_test1")
      await this.type('input#password','!labin_test1')
      await this.click('button[type="submit"]')
      
    }else{
      this.print(
        "can not found log in with password"
      )
    }
   
    this.print('Test executed');
  }
}
