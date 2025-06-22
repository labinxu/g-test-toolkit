export class TestCase{
  async test():Promise<void>{
    throw new Error('Not implemented');
  };
}
const __testCaseClasses: any[] = [];

export function Regist(): ClassDecorator {
  return function (constructor: Function,context?: any) {
    // 装饰器的实现逻辑，比如注册类等
    __testCaseClasses.push(constructor);
  } as any;;
}
export async function main(logger) {
  for (const Ctor of __testCaseClasses) {
    const instance = new Ctor();
    if (typeof instance.test === 'function') {
      await instance.test();
    }
    logger.debug(`Test ${Ctor.name} Complete!`)
  }

}
