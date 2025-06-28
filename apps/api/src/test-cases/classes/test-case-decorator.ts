// test-case-decorator.ts
export const __testCaseClasses: Function[] = [];

export function Test(): ClassDecorator {
  return function (constructor: Function) {
    __testCaseClasses.push(constructor);
  } as any;
}
