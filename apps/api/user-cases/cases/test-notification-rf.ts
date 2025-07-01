import { TestCase, Test } from 'test-case';
@Test()
class MyTest extends TestCase {
  async test_case1() {
    // prepare mobile clear all notifs

    this.configureDevice('0A171FDD40063C','holding display','125698',"300 900 300 200")
    await this.clearAllNotifications()
    await this.home()
    try{
      await this.goto('https://qa1-prod.gettr-qa.com/login?step=sea_login_with_email',{timeout:50000})
    }catch(err){
      this.printError(err)
    }
    this.print('main page opened')
    // login with password
    const spans = await this.$$('form.form.notranslate div span');
    let result = [];
    for (const span of spans) {
      const text = await span.evaluate(el => el.textContent.trim().toLowerCase());
      if (text === 'log in with password') {
        result.push(span)
        break;  // Stop after clicking the first match
      }
    }
    if(result.length!=1){
        return;
    }
    await result[0].click()
      await this.type('input#email',"labin_test1")
      await this.type('input#password','!labin_test1')
      const [response] = await Promise.all([
            this.waitForNetworkIdle(), // The promise resolves after navigation has finished
            this.click('button[type="submit"]'), // Clicking the link will indirectly cause a navigation
      ]);
      await this.waitForSelector('button[type="button"]')
      const createBt= await this.$$('button[type="button"]')

      await createBt[0].click()
      await this.waitForSelector('div#simple-popper button')
     
      const buttons = await this.$$('div#simple-popper button')
      // 0 create post,1 gtok ,2 create live
      this.printDebug('click create post')
      await buttons[0].click();
      const postContent = `this is post by pupe time:${Date.now()} `
      await this.type('div.post-preview-box div.ql-editor', postContent)
      await this.waitForNetworkIdle()
      await this.click('div.action-bar > button');
      
      await this.delay(5000);
      await this.screenOn();

      const exceptRet = await this.exceptIncludesNotifyText(postContent) 
      this.print(`except ${exceptRet}`)
      //await this.screenshot();
    this.printInfo('Test executed');
  }
}
