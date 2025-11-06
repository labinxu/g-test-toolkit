import { TestCase, Test, withBrowser, useBrowser } from 'test-case';
import {TestCaseHelper} from 'testcase-common';


@Test({ module: 'notification' })
@withBrowser({ headless: true, debug: false })
export class TestEvent extends TestCase {
  async eventHandler(event:any){
    this.printInfo('this is event handler')
  }
  async test_check_notif_setting() {
    const th = new TestCaseHelper(null)
   
      //   this.emiter.on('message', (msg) => {
    //     this.printDebug(msg)
    //     console.log(`收到消息: ${msg}`);
    //     resolve(msg); // 收到消息后解析 Promise
    //   });
    // const message = await new Promise((resolve,reject) => {
   
    //   this.emiter.on('message', (msg) => {
    //     this.printDebug(msg)
    //     console.log(`收到消息: ${msg}`);
    //     resolve(msg); // 收到消息后解析 Promise
    //   });
    // });
   
    //this.emiter.emit('message', '这是一个事件消息');
     
   
  }
  @useBrowser()
  async browser_events() { 
      //  this.emiter.on('message', (msg) => {
      //    this.printDebug(`message ${msg}`)
      //   console.log(`收到消息: ${msg}`);
      // });
     this.emiter.emit('event', '这是一个check 信号');
    await this.delay(2000)
    this.emiter.emit('event', '这是一个check 信号2');
}
}