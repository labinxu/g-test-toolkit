import { IPage } from './interface/ipage';

export class ProfilePage extends IPage {
  constructor(ins: any) {
    super(ins);
  }
  async switchPosts() {
    //content list: div#virtuoso>div>div>div
  }
  async deleteTopPost() {
    await this.delay();
    const moreBt = await this.page.waitForSelector(
      'div.profile.hover-class div.dropdown-w',
    );
    this.testcase.assertNotNull(moreBt, 'more button should not null');
    await moreBt.click();
    await this.delay();
    const deleteBt = await this.page.waitForSelector(
      'div.MuiPaper-root button.danger',
    );
    this.testcase.assertNotNull(deleteBt, 'delete button should not null');
    await this.delay();
    await deleteBt.click();
    await this.delay();
    const confirmDelete = await this.page.waitForSelector(
      'div.MuiDialogContent-root button:nth-of-type(2)',
    );
    this.testcase.assertNotNull(
      confirmDelete,
      'Confirm delete button should not null',
    );
    await confirmDelete.click();
    await this.delay();
  }
  async switchReplies() {}
}
