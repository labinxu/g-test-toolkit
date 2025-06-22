
export class TestCase{
  test(){
    console.log('test')
  }
}
const __testCaseClasses: any[] = [];

export function Regist<T extends { new (...args: any[]): {} }>(constructor: T) {
  __testCaseClasses.push(constructor);
}

async function main(logger) {
  for (const Ctor of __testCaseClasses) {
    const instance = new Ctor();
    if (typeof instance.test === 'function') {
      await instance.test();
    }
    logger.debug(`Test ${Ctor.name} Complete!`)
  }

}
