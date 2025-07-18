// test-case-decorator.ts
export const __testCaseClasses: Function[] = [];
export const __multiTaskClasses: Function[] = [];

export const __useBrowserStaticMethods: Record<string, Function[]> = {};

export function Test(options?: { module?: string }): ClassDecorator {
  return function (constructor: Function, ...args: any[]) {
    (constructor as any).module = options?.module ? options.module : 'default';
    __testCaseClasses.push(constructor);
    console.log('Decorator args', args);
  };
}
export function useBrowser() {
  return function (target: Function, context: ClassMethodDecoratorContext) {
    return function (this: any, ...args: any[]) {
      const className = this.constructor.name;
      const funcName = String(context.name);
      if (funcName.startsWith('browser')) {
      }
      const cloned = this.clone(`${className}.${String(context.name)}`);
      cloned.setPage(args[0]);
      __multiTaskClasses[className] = target.apply(cloned, args);
      return __multiTaskClasses[className];
    };
  };
}

export function withBrowser(options: {
  headless?: boolean;
  debug?: boolean;
}): ClassDecorator {
  return function (constructor: Function) {
    if (!options) {
      options = { headless: false, debug: true };
    }
    (constructor as any).__useBrowser = true;
    (constructor as any).__headless = options.headless;

    (constructor as any).__debug =
      options.debug === undefined ? true : options.debug;
  };
}
