
import { TestCase, Test,withBrowser,useBrowser} from 'test-case';
@Test()
@withBrowser({headless:false,debug:false})
export class TestBreakingNews extends TestCase {
  getRandomRoundedNumber() {
  const randomNum = Math.floor(Math.random() * (100000 - 1000 + 1)) + 1000;
  return Math.round(randomNum / 1000) * 1000;
}
  async login(userName,password) {
    try{
      await this.goto('https://qa1-prod.gettr-qa.com/login?step=sea_login_with_email')
      await this.waitForNetworkIdle()
    }catch(err){
      this.printError(err)
      return
    }
    this.centerSelector('form.form.notranslate div span')
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
      await this.type('input#email',userName)//"bng_labin")
      await this.type('input#password',password)//'a111111')
      // const [response] = await Promise.all([
      //       this.waitForNetworkIdle(), // The promise resolves after navigation has finished
      await this.click('button[type="submit"]') // Clicking the link will indirectly cause a navigation
      // ]);
      //await this.reload();
      //await this.waitForNetworkIdle({waituntil:"networkidle2"});
      await this.delay(10000)
      const createBt= await this.$('div.MuiBox-root:nth-of-type(1) >button:nth-of-type(3)')
      if(!createBt){
        this.printError('create button not found!')
        return;
      }
      return createBt;
    }
    async test_in_first(){
      await this.postbng("bng_labin",'a111111')
    }
    async postbng(userName:string,password:string){
      let createBt = await this.login(userName,password)
      let counter = 4;
      while(createBt && counter>0){
        counter -=1;
        await createBt.click()
        await this.delay(5000)
        const buttons = await this.$$('div#simple-popper >div>div>button:nth-of-type(1)')
        // 0 create post,1 gtok ,2 create live
        this.printDebug(`popper buttons: ${buttons.length}`)
        if(buttons.length<=0){
          this.printError('Failed to select div#simple-popper >div>div>button:nth-of-type(1)')
          return;
        }
        this.print(buttons[0])
        await buttons[0].click();
        const postContent = `post for bng test:${this.formatDateTime(new Date())} `
        await this.type('div.post-preview-box div.ql-editor', postContent)
        //await this.waitForNetworkIdle()
        this.print('wait for posted')
        await this.delay(2000)
        await this.click('div.action-bar > button');
        await this.delay(this.getRandomRoundedNumber());

        // repost 
        createBt= await this.$('div.MuiBox-root:nth-of-type(1) >button:nth-of-type(3)')
      }
    }
  @useBrowser()
  async browser_test_bng1(){
    await this.postbng("bng_labin1",'a111111')
  }
  @useBrowser()
  async browser_test_bng3(){
    await this.postbng("bng_labin_3",'a111111')
  }
  @useBrowser()
  async browser_test_bng2(){
    await this.postbng("post_notify_1",'a111111')
  }
  @useBrowser()
  async browser_test_bng4(){
    await this.postbng("post_notify_2",'a111111')
  }
}
