import { TestCase, Test, withBrowser } from 'core-lib';
@Test()
@withBrowser({ headless: false, debug: true })
export class TestQA_14848_comments extends TestCase {
  async test_reply_100comments_and_delete_60latest() {
    const username = 'post_notify_2';
    const posturl = 'https://qa15.gettr-qa.com/post/pdvoxfe83';
    let createBt;
    let counter = 4;
      while (counter > 0) {
        try {
          createBt = await this.login({
            url: 'https://qa15.gettr-qa.com/login?step=sea_login_with_email',
            account: username,
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
    await this.goto(posturl);
    await this.delay(2000)

    const do_comments = async () => {
      this.printDebug('do comments')
      let cmsbox = await this.$('div.post-box.comment-box div.ql-container.ql-snow')
      let number = 0;
      while (number < 3  && cmsbox) {
        this.print(`comment reply ${number}`)
        await cmsbox.click();
        await this.delay(1000);
        await this.waitForSelector('div.post-box.comment-box div.ql-container.ql-snow div.ql-editor');
        await this.waitForSelector('div.post-box.comment-box button')
        const postContent = `comments : ${number} `;

        await this.type('div.post-box.comment-box div.ql-container.ql-snow div.ql-editor', postContent);
        await this.delay(1000);
        await this.click('div.post-box.comment-box button');
        await this.delay(5000);
        number += 1;
        cmsbox = await this.$('div.post-box.comment-box div.ql-container.ql-snow')
      }

    };
    await do_comments();
    const do_delete = async () => {
      this.printDebug('do delete')
      let counter = 60;
      while (counter > 0) {
        const post_actions = await this.$(
          'div.comment-feed.hover-class div.dropdown-w',
        );
        await post_actions.click();
        await this.delay(1000);
        const del_post = await this.$(
          'div#simple-popper button.danger',
        );
        this.print(`delete post ${counter}`)
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
