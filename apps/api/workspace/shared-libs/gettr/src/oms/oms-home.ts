import { IPage } from '../interface/ipage';
import { CreatorsPage } from './creators-page';

export class OMSHome extends IPage {
  constructor(instance: any) {
    super(instance);
  }
  async gotoCreatorsPage() {
    const creatorsEl = await this.page.$(
      'div.app-oms.module tr:nth-of-type(3)',
    );
    this.testcase.assertNotNull(creatorsEl, 'creators menu');

    return new CreatorsPage(this.testcase);
  }
}
