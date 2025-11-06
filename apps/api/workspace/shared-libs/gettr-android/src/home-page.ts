import {IPage} from "./interface/ipage"
export class HomePage extends IPage {
  constructor(instance: any) {
    super(instance)
  }
  public async clickHere(): Promise<void> {
    await this.page.$('~Click here to access Direct Message').click();
  }
  public async sideMenuButton(): Promise<void> {
    await this.page.$('~side menu button').click();
  }
  
  public async exploreTab(): Promise<void> {
    await this.page.$('~Explore\nTab 1 of 3').click();
  }
  public async followingTab(): Promise<void> {
    await this.page.$('~Following\nTab 2 of 3').click();
  }
  public async breakingTab(): Promise<void> {
    await this.page.$('~Breaking\nTab 3 of 3').click();
  }
  public async all(): Promise<void> {
    await this.page.$('~All').click();
  }
  public async news(): Promise<void> {
    await this.page.$('~News').click();
  }
  public async maga(): Promise<void> {
    await this.page.$('~MAGA').click();
  }
  public category(category:string){
    
  }
  public async postFrom(): Promise<void> {
    await this.page.$('~Post from SteveBannon').click();
  }
  public async remindMeLater(): Promise<void> {
    await this.testcase.clickIfPresent('~Remind me later')
    //await this.page.$('~Remind me later').click();
    await this.page.pause(1000)
  }
  public async startTheTour(): Promise<void> {
    await this.page.$('~Start the tour').click();
  }
  public async crypto(): Promise<void> {
    await this.page.$('~Crypto').click();
  }
  public async creatorLabel(): Promise<void> {
    await this.page.$('~creator label').click();
  }
}
