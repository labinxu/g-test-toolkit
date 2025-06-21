import { BrowserControl } from "src/browser/browser";

export class TestCase{
  url:string;
  constructor(url:string){
    this.url = url
  }
  async start(){
    const bc = new BrowserControl()
    const page = await bc.launch(false);
    await page.goto(this.url)

  }
}
