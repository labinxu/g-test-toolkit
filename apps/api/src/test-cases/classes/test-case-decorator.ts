// test-case-decorator.ts
export const __testCaseClasses: Function[] = [];
export let __useBrowser: boolean = false;
export let __withHeadless: boolean = false;
export function Test(): ClassDecorator {
  return function (constructor: Function) {
    __testCaseClasses.push(constructor);
  };
}

export function WithHeadless(): ClassDecorator {
  return function (constructor: Function) {
    __withHeadless = true;
    (constructor as any).__withHeadless = true;
  };
}
