// test-case-decorator.ts
import path from 'path'

export const __testCaseClasses: Function[] = []
export const __multiTaskClasses: Function[] = []

export const __useBrowserStaticMethods: Record<string, Function[]> = {}

export function Test(options?: { module?: string }): ClassDecorator {
  return function (constructor: Function, ...args: any[]) {
    ;(constructor as any).module = options?.module ? options.module : 'default'
    __testCaseClasses.push(constructor)
    console.log('Decorator args', args)
  }
}
export function useBrowser() {
  return function (target: Function, context: ClassMethodDecoratorContext) {
    return function (this: any, ...args: any[]) {
      const className = this.constructor.name
      const funcName = String(context.name)
      if (funcName.startsWith('browser')) {
      }
      const cloned = this.clone(`${className}.${String(context.name)}`)
      cloned.setPage(args[0])
      __multiTaskClasses[className] = target.apply(cloned, args)
      return __multiTaskClasses[className]
    }
  }
}

export function withBrowser(options: {
  headless?: boolean
  debug?: boolean
  timeout?: number
  domain?: string
  retry?: number
}): ClassDecorator {
  return function (constructor: Function) {
    const opts = {
      headless: false,
      debug: true,
      timeout: 60000,
      domain: undefined,
      retry: 3,
      ...options,
    }
    ;(constructor as any).__useBrowser = true
    ;(constructor as any).__headless = opts.headless
    ;(constructor as any).__timeout = opts.timeout
    ;(constructor as any).__domain = opts.domain
    ;(constructor as any).__debug = opts.debug
    ;(constructor as any).__retry = opts.retry
  }
}
export function withAndroid(options: {
  deviceName: string
  udid: string
  apk: string
  protocol?: string
  hostname?: string
  port?: number
  path?: string
  timeout?: number
  retry?: number
}): ClassDecorator {
  return function (constructor: Function) {
    const opts = {
      protocol: 'http',
      hostname: 'localhost',
      port: 4723,
      path: '/',
      timeout: 60000,
      retry: 3,
      ...options,
    }
    ;(constructor as any).__withAndroid = true
    ;(constructor as any).__timeout = opts.timeout
    ;(constructor as any).__retry = opts.retry
    ;(constructor as any).__androidOpts = {
      protocol: opts.protocol,
      hostname: opts.hostname,
      port: 4723,
      path: opts.path,
      capabilities: {
        platformName: 'Android',
        'appium:deviceName': opts.deviceName,
        'appium:udid': opts.udid,
        'appium:app': path.join(
          __dirname,
          '../../../../',
          process.env.APP_DIR || 'workspace/app',
          opts.apk
        ),
        'appium:automationName': 'UiAutomator2',
        'appium:autoGrantPermissions': true,
        'appium:autoAcceptAlerts': true,
        'appium:disableHiddenApiPolicyPrePApp': true,
        'appium:ignoreHiddenApiPolicyError': true,
      },
    }
  }
}
