// test-case-decorator.ts
export const __testCaseClasses: Function[] = [];
export function Test(): ClassDecorator {
  return function (constructor: Function) {
    __testCaseClasses.push(constructor);
  };
}

export function WithBrowser(options: { headless: boolean; debug: boolean }) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    (constructor as any).__useBrowser = true;
    (constructor as any).__headless = options.headless;

    (constructor as any).__debug =
      options.debug === undefined ? true : options.debug;
  };
}
