import { IPage } from './interface/ipage';
export class CreateInstantPage extends IPage{
  constructor(protected testcase:any) {
    super(testcase);
  }
  async verify() {
    
  }
}