import { IPage } from './interface/ipage';

export class ProfilePage extends IPage {
  constructor(ins: any) {
    super(ins);
  }
  async switchPosts() {
    //content list: div#virtuoso>div>div>div
  }
  async switchReplies() {}
}
