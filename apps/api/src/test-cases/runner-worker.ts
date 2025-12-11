import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'
import * as vm from 'vm'
import { BrowserHelper } from 'src/browser/browser-helper'

type RunMessage = {
  type: 'run'
  code: string
  clientId?: string
  options?: {
    keepAppOpen?: boolean
    shareSession?: boolean
    sessionKey?: string
    userDir?: string
    apiTestsConfig?: { baseUrl: string; defaultHeaders: Record<string, string> }
    workspace?: string
    envConfig?: any
    reportMeta?: { platform?: string; module?: string; caseName?: string }
  }
}

function sendMessage(msg: any) {
  if (typeof process.send === 'function') {
    try {
      process.send(msg)
    } catch {}
  }
}

class SimpleLogger {
  private context: string
  private clientId?: string
  constructor(context: string, clientId?: string) {
    this.context = context
    this.clientId = clientId
  }
  private format(level: string, message: string) {
    const ts = new Date().toISOString()
    const ctx = this.context ? `[${this.context}]` : ''
    const cid = this.clientId ? `[${this.clientId}]` : ''
    return `${ts} ${ctx}${cid} [${level}] ${message}`
  }
  info(message: string) {
    const line = this.format('info', message)
    console.log(line)
  }
  error(message: string) {
    const line = this.format('error', message)
    console.error(line)
  }
  warn(message: string) {
    const line = this.format('warn', message)
    console.warn(line)
  }
  debug(message: string) {
    const line = this.format('debug', message)
    console.debug(line)
  }
  verbose(message: string) {
    const line = this.format('verbose', message)
    console.log(line)
  }
  setContext(context: string) {
    this.context = context
  }
  // no-op file transports in worker
  addLogFileTransports(_filename: string) {
    return null
  }
  removeLogFileTransports(_transport: any) {}
  complete(_clientId?: string, message = 'exit') {
    const line = this.format('info', message)
    console.log(line)
  }
}

class SimpleLoggerService {
  createLogger(context: string, clientId?: string) {
    const logger = new SimpleLogger(context, clientId)
    logger.debug(`createLogger ${context}`)
    return logger
  }
}

async function transformCodeWorker(code: string): Promise<string> {
  const result = await esbuild.transform(code, {
    loader: 'ts',
    format: 'cjs',
    platform: 'node',
    sourcemap: false,
    minify: false,
    target: 'esnext',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  } as esbuild.TransformOptions)
  return result.code
}

async function loadLibFromDir(envKey: string, defaultDir: string, libName: string) {
  const baseDir = path.join(
    __dirname,
    '../..',
    process.env[envKey] || defaultDir,
  )
  const cjsPath = path.join(baseDir, 'dist/index.js')
  const mjsPath = path.join(baseDir, 'dist/index.mjs')
  const dynamicImport = (p: string) => new Function('p', 'return import(p)')(p) as Promise<any>
  if (fs.existsSync(mjsPath)) {
    try {
      const { pathToFileURL } = require('url')
      const href = pathToFileURL(mjsPath).href
      return await dynamicImport(href)
    } catch (e) {
      // Fallback to CJS if ESM build is not loadable
      if (fs.existsSync(cjsPath)) {
        try {
          delete require.cache[require.resolve(cjsPath)]
        } catch {}
        return require(cjsPath)
      }
      throw e
    }
  }
  if (fs.existsSync(cjsPath)) {
    // clear require cache best-effort
    try {
      delete require.cache[require.resolve(cjsPath)]
    } catch {}
    return require(cjsPath)
  }
  throw new Error(`${libName} not found at ${baseDir}/dist`)
}

async function runInWorker(message: RunMessage) {
  const { code, clientId, options } = message
  const workspace = options?.workspace || process.env.WORKSPACE || 'workspace'
  const loggerService = new SimpleLoggerService()
  const logger = loggerService.createLogger('runner-worker', clientId)
  try {
    // 将运行期 envConfig 与 logger 信息注入到全局，供 core-lib 使用
    try {
      ;(globalThis as any).__gttEnvConfig = options?.envConfig ?? null
      ;(globalThis as any).__gttLoggerService = loggerService
      ;(globalThis as any).__gttClientId = clientId
    } catch {
      // ignore
    }

    logger.info('Runner worker started')
    const transformedCode = await transformCodeWorker(code)
    const coreLib = await loadLibFromDir(
      'CORE_LIB_DIR',
      'workspace/shared-libs/core',
      'core-lib',
    )
    const gettrLib = await loadLibFromDir(
      'GETTR_LIB_DIR',
      'workspace/shared-libs/gettr-web',
      'gettr-lib',
    )
    const gettrAndroidLib = await loadLibFromDir(
      'GETTR_ANDROID_LIB_DIR',
      'workspace/shared-libs/gettr-android',
      'gettr-android-lib',
    )
    const gettrMobileWebLib = await loadLibFromDir(
      'GETTR_MOBILE_WEB_LIB_DIR',
      'workspace/shared-libs/gettr-mobile-web',
      'gettr-mobile-web-lib',
    )
    if (typeof coreLib?.clearBddSuites === 'function') {
      coreLib.clearBddSuites()
    }

    const sandbox: any = {
      require: (moduleName: string) => {
        if (moduleName === 'core-lib') return coreLib
        if (moduleName === 'gettr-lib') return gettrLib
        if (moduleName === 'gettr-web-lib') return gettrLib
        if (moduleName === 'gettr-android-lib') return gettrAndroidLib
        if (moduleName === 'gettr-mobile-web-lib') return gettrMobileWebLib
        return require(moduleName)
      },
      module: { exports: {} },
      exports: {},
  params: {
    workspace,
    clientId,
    apiTestConfig: options?.apiTestsConfig ?? undefined,
    loggerService,
    browserHelper: new BrowserHelper(),
    options: {
      keepAppOpen: options?.keepAppOpen,
      shareSession: options?.shareSession,
      sessionKey: options?.sessionKey,
      userDir: options?.userDir,
      reportMeta: options?.reportMeta,
    },
    userDir: options?.userDir,
    envConfig: options?.envConfig,
  },
      console,
      coreMain: coreLib.main,
      describe: coreLib.describe,
      it: coreLib.it,
      test: coreLib.test,
      beforeAll: coreLib.beforeAll,
      afterAll: coreLib.afterAll,
      beforeEach: coreLib.beforeEach,
      afterEach: coreLib.afterEach,
      useTestCase: coreLib.useTestCase,
    }

    const context = vm.createContext(sandbox)
    const wrappedCode = `${transformedCode}
      globalThis.__gttCorePromise = (async () => {
        return await coreMain(params)
      })();`
    const script = new vm.Script(wrappedCode, { filename: 'testcase.js' })
    script.runInContext(context)
    const corePromise = (context as any).__gttCorePromise
    const coreResult =
      corePromise && typeof corePromise.then === 'function' ? await corePromise : undefined
    sendMessage({ type: 'complete', clientId, coreResult, reportMeta: options?.reportMeta })
    logger.info('Runner worker completed')
  } catch (err: any) {
    const msg = err?.message || String(err)
    const stack = err?.stack || ''
    console.error(`Runner worker error: ${msg}\n${stack}`)
    sendMessage({ type: 'error', clientId, error: msg, stack })
    // 直接退出子进程，保证父进程能够接收到 exit 事件，从而清理 runners 映射，
    // 避免后续再次运行同一 clientId 时被误判为“已有任务在运行”。
    process.exit(1)
  }
}

process.on('message', (raw: any) => {
  if (!raw || raw.type !== 'run') return
  void runInWorker(raw as RunMessage)
})
