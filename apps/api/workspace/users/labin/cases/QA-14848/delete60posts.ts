import { TestCase, Test, withBrowser } from 'core-lib';
@Test()
@withBrowser({ headless: false, debug: true })
export class TestQA_14848 extends TestCase {
  async test_post_100posts_and_delete_60latest() {
    const username = 'post_notify_1';

    const do_post = async () => {

      let createBt;
      let counter = 4;
      while (counter > 0) {
        try {
          createBt = await this.login({
            url: 'https://qa15.gettr-qa.com/login?step=sea_login_with_email',
            account: 'post_notify_1',
            password: 'a111111',
          });
          if (createBt) {
            break;
          }
        } catch (err) {
          counter -= 1;
        }
      }
      this.exceptNotNull(createBt);
      let number = 0;
      while (number < 2  && createBt) {
        await createBt.click();
        await this.delay(1000);
        await this.waitForSelector('div#simple-popper button');

        const buttons = await this.$$('div#simple-popper button');
        await buttons[0].click();
        await this.delay(1000);
        const postContent = `post1 : ${number} `;

        await this.type('div.post-preview-box div.empty-space', postContent);
        await this.delay(1000);
        await this.click('div.action-bar > button');
        await this.delay(5000);
        number += 1;
      }

    };
    await do_post();
    const do_delete = async () => {
      
      let counter = 2;
      while (counter > 0) {
        const post_actions = await this.$(
          'div.comment-feed.hover-class div.dropdown-w',
        );
        await post_actions.click();
        await this.delay(1000);
        const del_post = await this.$(
          'div#simple-popper button.danger',
        );
        this.print('delete post')
        await del_post.click();
        const confirm = await this.$('div.MuiDialogContent-root button:nth-of-type(2)');
        this.print('confirm delete')
        await confirm.click();
        await this.delay(2000);
        counter -=1
        await this.reload()
        await this.delay(3000)
      }
    };

    await do_delete();
  }
}
