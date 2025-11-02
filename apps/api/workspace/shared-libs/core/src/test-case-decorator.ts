// test-case-decorator.ts
import path from 'path'
import fs from 'fs'

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
//adb shell cmd package resolve-activity --brief com.gettr.gettr | head -n 1
//
export type WithAndroidOptions = {
  deviceName: string
  udid: string
  /**
   * 当以“安装模式”运行时使用的 APK 文件名（位于 `workspace/app` 或 `APP_DIR` 指定目录下）
   */
  apk?: string
  /** 当以“直启模式”运行时使用的包名，例如：com.example.app */
  appPackage?: string
  /** 当以“直启模式”运行时使用的入口 Activity，例如：.MainActivity 或 com.example.app.MainActivity */
  appActivity?: string
  protocol?: string
  hostname?: string
  port?: number
  path?: string
  timeout?: number
  retry?: number
  /** 执行完成后是否保持 App 运行 */
  keepAppOpen?: boolean
  /** 直启模式下是否清理数据。默认 true（不清理） */
  noReset?: boolean
  /** 直启模式下是否在 reset 时不停止 App。默认 true */
  dontStopAppOnReset?: boolean
  /** Whether to bring the app to foreground after session (create/reuse). Default: true */
  bringToFront?: boolean
}

export function withAndroid(options: WithAndroidOptions): ClassDecorator {
  return function (constructor: Function) {
    const opts = {
      protocol: 'http',
      hostname: 'localhost',
      port: 4723,
      path: '/',
      timeout: 60000,
      retry: 3,
      keepAppOpen: true,
      // Default to reinstall/reset app data during install mode, but do not uninstall after
      noReset: false,
      dontStopAppOnReset: true,
      bringToFront: true,
      ...options,
    }
    ;(constructor as any).__withAndroid = true
    ;(constructor as any).__timeout = opts.timeout
    ;(constructor as any).__retry = opts.retry
    ;(constructor as any).__keepAppOpen = opts.keepAppOpen
    // 保存 Appium Server 连接信息
    ;(constructor as any).__androidServer = {
      protocol: opts.protocol,
      hostname: opts.hostname,
      port: opts.port,
      path: opts.path,
    }

    // 基础能力（两种模式共享）
    const baseCaps: Record<string, any> = {
      platformName: 'Android',
      'appium:deviceName': opts.deviceName,
      'appium:udid': opts.udid,
      'appium:automationName': 'UiAutomator2',
      'appium:autoGrantPermissions': true,
      'appium:autoAcceptAlerts': true,
      'appium:disableHiddenApiPolicyPrePApp': true,
      'appium:ignoreHiddenApiPolicyError': true,
    }

    // 解析 APK 绝对路径（支持 APP_DIR、常见仓库路径、以及相对/绝对自定义值）
    const resolveApkPath = (apk?: string): string | undefined => {
      if (!apk) return undefined
      if (path.isAbsolute(apk)) return apk
      const envDir = process.env.APP_DIR ? path.resolve(process.cwd(), process.env.APP_DIR) : undefined
      const candidates = [
        envDir,
        path.resolve(process.cwd(), 'apps/api/workspace/app'),
        path.resolve(process.cwd(), 'workspace/app'),
        path.resolve(__dirname, '../../../app'), // from dist to workspace/app
        path.resolve(__dirname, '../../../../app'), // in case dist has an extra nesting
      ].filter(Boolean) as string[]
      for (const dir of candidates) {
        const p = path.join(dir, apk)
        try {
          if (fs.existsSync(p)) return p
        } catch {}
      }
      // Fallback to original join (may be incorrect but keeps prior behavior)
      return path.join(
        __dirname,
        '../../../../',
        process.env.APP_DIR || 'workspace/app',
        apk
      )
    }

    // 安装模式 capabilities（提供 apk 时可用）
    const capsInstall = (() => {
      if (!opts.apk) return undefined
      return {
        ...baseCaps,
        'appium:app': resolveApkPath(opts.apk),
        // Keep app installed after session by default
        'appium:fullReset': false,
        'appium:noReset': opts.noReset,
        'appium:dontStopAppOnReset': opts.dontStopAppOnReset,
      }
    })()

    // 直启模式 capabilities（提供包名与 Activity 时可用）
    const capsLaunch = (() => {
      if (!opts.appPackage || !opts.appActivity) return undefined
      return {
        ...baseCaps,
        'appium:appPackage': opts.appPackage,
        'appium:appActivity': opts.appActivity,
        'appium:noReset': opts.noReset,
        'appium:dontStopAppOnReset': opts.dontStopAppOnReset,
      }
    })()

    ;(constructor as any).__androidCapsInstall = capsInstall
    ;(constructor as any).__androidCapsLaunch = capsLaunch
    // 自动推断默认运行模式：优先 apk（install），否则当存在 appPackage 时为 launch
    const autoInstallBehavior: 'install' | 'launch' | undefined = opts.apk
      ? 'install'
      : opts.appPackage
      ? 'launch'
      : undefined
    ;(constructor as any).__androidInstallBehavior = autoInstallBehavior
    ;(constructor as any).__androidBringToFront = !!opts.bringToFront

    // 为向后兼容保留 __androidOpts（默认按“安装模式”构造）
    ;(constructor as any).__androidOpts = {
      ...(constructor as any).__androidServer,
      capabilities: capsInstall ?? capsLaunch ?? baseCaps,
    }
  }
}
