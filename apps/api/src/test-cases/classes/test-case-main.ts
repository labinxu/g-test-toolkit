export { TestCase } from './test-case-base';
export { Test, withBrowser } from './test-case-decorator'; // Import the default
export { __testCaseClasses } from './test-case-decorator';
// 如果还要导出 main、__testCaseClasses 等，看具体需要
export { main } from './test-case-main-impl';
