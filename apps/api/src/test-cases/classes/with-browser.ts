export function WithBrowser(options: { headless: boolean }) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    (constructor as any).__useBrowser = true;
    (constructor as any).__headless = options.headless;
  };
}
