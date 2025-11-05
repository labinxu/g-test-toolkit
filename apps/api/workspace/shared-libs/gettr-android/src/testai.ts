import {IPage} from './interface/ipage';

export class PostPage extends IPage{
  constructor(private testcase: any) {
    super(testcase);
  }
  async post() {
    await this.page.$('~Post').click();
  }
  async idAvatarJohannesVk() {
    await this.page.$('~id_avatar johannes_vk').click();
  }
  async johannesVk9h() {
    await this.page.$('~@johannes_vk · 9h').click();
  }
  async johannes() {
    await this.page.$('~Johannes').click();
  }
  async translatePost() {
    await this.page.$('~Translate post').click();
  }
  async _1Like() {
    await this.page.$('~1, like count&#10;2&#10;1&#10;Like').click()
  }
  async comment() {
    await this.page.$('~Comment').click();
  }
  async like() {
    await this.page.$('~like').click();
  }
  async repost() {
    await this.page.$('~repost').click();
  }
  async share() {
    await this.page.$('~share').click();
  }
  async tip() {
    await this.page.$('~tip').click();
  }
  async writeYour() {
    await this.page.$('~Write your reply').click();
  }
  async liveStream() {
    await this.page.$('~Live Stream Clipping is now available!').click();
  }
}
