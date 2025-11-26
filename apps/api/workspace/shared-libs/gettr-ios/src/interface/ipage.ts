import { TestCase } from '../../../core/src/test-case-base';

export class IPage {
  protected testcase: any;

  constructor(testInstance: any) {
    this.testcase = testInstance;
  }

  async delay(ms?: number) {
    const sleep = (v: number) => new Promise((resolve) => setTimeout(resolve, v));
    await sleep(ms ? ms : this.delayTime);
  }

  get delayTime() {
    return this.testcase.delaytime;
  }

  get page() {
    return this.testcase.page;
  }

  get logger() {
    return this.testcase.logger;
  }
}
