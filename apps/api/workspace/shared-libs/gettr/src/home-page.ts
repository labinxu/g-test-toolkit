import { IPage } from 'core-lib';

export class HomePage implements IPage {
  goto(url: string) {
    console.log(`goto ${url}`);
  }
}
