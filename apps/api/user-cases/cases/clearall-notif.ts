import { TestCase, Test } from 'test-case';
@Test()
class ClearAll extends TestCase {
  async test_run() {
    await this.configureDevice('0A171FDD40063C','holding display','125698',"300 900 300 200")
    await this.clearAllNotifications()
  }
}
