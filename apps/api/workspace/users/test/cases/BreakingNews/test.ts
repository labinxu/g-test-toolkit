import { TestCase, Test,withBrowser,useBrowser} from 'test-case';
@Test()
export class TestBreakingNews extends TestCase {
    async test_demo(){
        this.print('test case')
    }
}