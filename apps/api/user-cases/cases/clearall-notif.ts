import { TestCase, Regist } from 'test-case';
@Regist()
class MyTest extends TestCase {
  async run() {
    this.configurePhone('0A171FDD40063C','holding display','125698',"300 900 300 200")
    await this.clearAllNotifications()
  }
}
