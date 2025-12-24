import { Injectable } from '@nestjs/common'
import { LoggerService } from 'src/logger/logger.service'
import { AndroidService } from 'src/mobile/android/android.service'
import { CustomLogger } from 'src/logger/logger.custom'
import { ReportService } from 'src/report/report.service'
import * as esbuild from 'esbuild'
import * as fs from 'fs'
import path from 'path'
// import { pathToFileURL } from 'url';
import * as vm from 'vm'
import { Project } from 'ts-morph'
import { BrowserHelper } from 'src/browser/browser-helper'
import { SettingsService } from 'src/settings/settings.service'
import { ChildProcess, fork } from 'child_process'
@Injectable()
export class TestCasesService {
  private logger: CustomLogger
  private coreModule = null
  private coreModuleLastUpdate = null
  private gettrWebModule: any = null
  private gettrWebModuleLastUpdate: number | null = null
  private gettrAndroidModule: any = null
  private gettrAndroidModuleLastUpdate: number | null = null
  private gettrMobileWebModule: any = null
  private gettrMobileWebModuleLastUpdate: number | null = null
  private runners: Map<string, ChildProcess> = new Map()
  private stoppingRunners: Set<string> = new Set()
  private manualStopNotified: Set<string> = new Set()
  constructor(
    private readonly loggerService: LoggerService,
    private readonly androidService: AndroidService,
    private readonly reportService: ReportService,
    private readonly settingsService: SettingsService
  ) {
    this.logger = this.loggerService.createLogger('TestCaseService')
  }
  deepClearCache(modulePath: string, visited: Set<string> = new Set()) {
    let resolved: string
    try {
      resolved = require.resolve(modulePath)
    } catch {
      return
    }
    if (visited.has(resolved)) return
    visited.add(resolved)

    const mod = require.cache[resolved]
    if (!mod) return

    // 先清理子模块，避免循环依赖
    for (const child of mod.children) {
      this.deepClearCache(child.id, visited)
    }

    // 删除当前模块缓存
    delete require.cache[resolved]

    // 额外清理：如果模块路径是绝对路径，也尝试清理相对路径的缓存
    const relativePath = path.relative(process.cwd(), resolved)
    if (relativePath !== resolved) {
      delete require.cache[relativePath]
    }
  }

  async transformCode(code: string): Promise<string> {
    try {
      const result = await esbuild.transform(code, {
        loader: 'ts', // 支持 TypeScript
        format: 'cjs', // 输出 CommonJS
        platform: 'node',
        // external: ['core-lib', 'gettr-lib'] as string[], // 排除 core-lib 和 gettr-lib，保留 require 调用
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
    } catch (error) {
      console.error('Failed to transform code with esbuild:', error)
      throw error
    }
  }
  private resolveRunnerScript() {
    const jsPath = path.join(__dirname, 'runner-worker.js')
    if (fs.existsSync(jsPath)) return { path: jsPath, isTs: false }
    const tsPath = path.join(__dirname, 'runner-worker.ts')
    return { path: tsPath, isTs: true }
  }

  async runInChildProcess(
    code: string,
    clientId?: string,
    options?: {
      keepAppOpen?: boolean
      shareSession?: boolean
      sessionKey?: string
      userDir?: string
      envConfig?: any
      reportMeta?: { platform?: string; module?: string; caseName?: string }
    }
  ) {
    // Ensure shared-libs dist outputs are available and up-to-date before the worker loads them.
    // (runner-worker loads from dist directly and does not rebuild.)
    try {
      await this.loadCoreLib()
      await this.loadGettrWebLib()
      await this.loadGettrAndroidLib()
      await this.loadGettrMobileWebLib()
    } catch (e) {
      this.logger.warn(`Failed to pre-load shared libs before worker run: ${e}`)
      // Continue; worker will surface the error if libs are truly missing.
    }
    if (!clientId) {
      // fall back to in-process when clientId is missing
      return this.runInSandbox(code, clientId, options)
    }
    if (this.runners.has(clientId)) {
      this.logger.warn(
        `Runner already active for clientId=${clientId}, attempting to stop existing runner before starting a new one`,
      )
      try {
        await this.killRunnerForClient(clientId)
      } catch {
        // ignore stop errors and try to start a fresh runner
      }
    }
    let apiTestsConfig: {
      baseUrl: string
      defaultHeaders: Record<string, string>
    } | null = null
    try {
      apiTestsConfig = await this.settingsService.getApiTestsConfig()
    } catch {
      apiTestsConfig = null
    }
    const { path: workerPath, isTs } = this.resolveRunnerScript()
    const forkOpts: any = {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: process.env,
    }
    if (isTs) {
      forkOpts.execArgv = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
    }
    const child = fork(workerPath, [], forkOpts)
    this.runners.set(clientId, child)

    child.stdout?.on('data', (buf: Buffer) => {
      const text = buf.toString('utf-8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        this.logger.sendTo(clientId, line, 'info')
      }
    })
    child.stderr?.on('data', (buf: Buffer) => {
      const text = buf.toString('utf-8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        // When runner is being stopped manually, send a single friendly error
        // message to the client and suppress the underlying Puppeteer noise.
        if (this.stoppingRunners.has(clientId)) {
          if (!this.manualStopNotified.has(clientId)) {
            this.logger.sendTo(clientId, 'Test case stopped by user', 'error')
            this.manualStopNotified.add(clientId)
          }
          continue
        }
        this.logger.sendTo(clientId, line, 'error')
      }
    })

    child.on('message', async (msg: any) => {
      try {
        if (msg?.type === 'complete') {
          await this.generateReportsFromCoreResult(
            msg.coreResult,
            process.env.WORKSPACE,
            msg.reportMeta,
          )
          this.logger.complete(clientId, 'exit')
        } else if (msg?.type === 'error') {
          this.logger.error(
            `Runner error for ${clientId}: ${msg.error}${msg.stack ? `\n${String(msg.stack)}` : ''}`
          )
          // 确保前端能够感知本次任务已结束（即便是异常中止），否则下一次运行会因为
          // runner 依然被认为“占用中”而无法正常输出日志。
          this.logger.complete(clientId, 'exit')
        }
      } catch (e) {
        this.logger.error(`Failed handling runner message for ${clientId}: ${e}`)
      }
    })

    child.on('exit', (code, signal) => {
      this.runners.delete(clientId)
      this.logger.info(
        `Runner exited for clientId=${clientId} code=${code ?? 'null'} signal=${signal ?? 'null'}`
      )
    })

    child.send({
      type: 'run',
      code,
      clientId,
      options: {
        keepAppOpen: options?.keepAppOpen,
        shareSession: options?.shareSession,
        sessionKey: options?.sessionKey,
        userDir: options?.userDir,
        apiTestsConfig: apiTestsConfig ?? undefined,
        workspace: process.env.WORKSPACE,
        envConfig: options?.envConfig,
        reportMeta: options?.reportMeta,
      },
    })
  }

  async killRunnerForClient(clientId: string) {
    const child = this.runners.get(clientId)
    if (!child) return
    this.logger.warn(`Killing runner for clientId=${clientId}`)
    this.stoppingRunners.add(clientId)
    if (!this.manualStopNotified.has(clientId)) {
      this.logger.sendTo(clientId, 'Test case stopped by user', 'error')
      this.manualStopNotified.add(clientId)
    }
    return await new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        this.runners.delete(clientId)
        this.stoppingRunners.delete(clientId)
        this.manualStopNotified.delete(clientId)
        resolve()
      }
      child.once('exit', finish)
      try {
        child.kill('SIGTERM')
      } catch {
        finish()
      }
      setTimeout(() => {
        try {
          if (!done && !child.killed) {
            child.kill('SIGKILL')
          }
        } catch {
        } finally {
          finish()
        }
      }, 5000)
    })
  }
  async runInSandbox(
    code: string,
    clientId?: string,
    options?: {
      keepAppOpen?: boolean
      shareSession?: boolean
      sessionKey?: string
      userDir?: string
      envConfig?: any
      reportMeta?: { platform?: string; module?: string; caseName?: string }
    }
  ): Promise<any> {
    let transformedCode = ''
    let coreLib: any
    let gettrWebLib: any
    let gettrAndroidLib: any
    let gettrMobileWebLib: any
    let apiTestsConfig: {
      baseUrl: string
      defaultHeaders: Record<string, string>
    } | null = null
    // simple cooperative stop flag, keyed by clientId
    const stopRef: { requested: boolean } = { requested: false }
    let stopKey: string | undefined
    if (clientId) {
      try {
        const g = globalThis as any
        if (!g.__gttStopFlags) {
          g.__gttStopFlags = new Map<string, { requested: boolean }>()
        }
        const flags: Map<string, { requested: boolean }> = g.__gttStopFlags
        flags.set(clientId, stopRef)
        stopKey = clientId
      } catch {}
    }

    try {
      transformedCode = await this.transformCode(code)
      // 加载 core-lib
      coreLib = await this.loadCoreLib()
      gettrWebLib = await this.loadGettrWebLib()
      gettrAndroidLib = await this.loadGettrAndroidLib()
      gettrMobileWebLib = await this.loadGettrMobileWebLib()
      try {
        apiTestsConfig = await this.settingsService.getApiTestsConfig()
      } catch {
        apiTestsConfig = null
      }
      if (typeof coreLib?.clearBddSuites === 'function') {
        coreLib.clearBddSuites()
      }
    } catch (err) {
      this.logger.complete(clientId)
      return
    }
    // 创建沙盒上下文
    const sandbox: any = {
      require: (moduleName: string) => {
        if (moduleName === 'core-lib') {
          return coreLib
        }
        if (moduleName === 'gettr-web-lib') {
          return gettrWebLib
        }
        if (moduleName === 'gettr-android-lib') {
          return gettrAndroidLib
        }
        if (moduleName === 'gettr-mobile-web-lib') {
          return gettrMobileWebLib
        }
        return require(moduleName)
        //throw new Error(`Module ${moduleName} not found in sandbox`);
      },
      module: { exports: {} },
      exports: {},
      params: {
        workspace: process.env.WORKSPACE,
        clientId,
        apiTestConfig: apiTestsConfig ?? undefined,
        loggerService: this.loggerService,
        browserHelper: new BrowserHelper(),
        options: {
          keepAppOpen: options?.keepAppOpen,
          shareSession: options?.shareSession,
          sessionKey: options?.sessionKey,
          userDir: options?.userDir,
          reportMeta: options?.reportMeta,
          shouldStop: () => stopRef.requested,
        },
        userDir: options?.userDir,
        envConfig: options?.envConfig,
      }, // 注入传入的参数
      console, // 注入 console 以支持 console.log
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
    try {
      // 创建隔离的上下文
      const context = vm.createContext(sandbox)
      // 包装代码
      const wrappedCode = `${transformedCode}
      globalThis.__gttCorePromise = (async () => {
        return await coreMain(params)
      })();`

      const script = new vm.Script(wrappedCode, { filename: 'testcase.js' })
      script.runInContext(context)
      const corePromise = context.__gttCorePromise
      const coreResult =
        corePromise && typeof corePromise.then === 'function' ? await corePromise : undefined

      await this.generateReportsFromCoreResult(
        coreResult,
        sandbox.params.workspace,
        options?.reportMeta,
      )

      return coreResult
    } catch (error) {
      console.error('Sandbox execution failed:', error)
      throw error
    } finally {
      if (stopKey) {
        try {
          const g = globalThis as any
          const flags: Map<string, { requested: boolean }> | undefined = g.__gttStopFlags
          flags?.delete(stopKey)
        } catch {}
      }
    }
  }
  private async generateReportsFromCoreResult(
    coreResult: any,
    workspaceValue?: string,
    meta?: { platform?: string; module?: string; caseName?: string },
  ) {
    if (!coreResult || !Array.isArray(coreResult.results)) return
    const rawWorkspace = workspaceValue || process.env.WORKSPACE || 'workspace'
    const workspaceRoot = path.isAbsolute(rawWorkspace)
      ? rawWorkspace
      : path.resolve(process.cwd(), rawWorkspace)

    const normalizeUserDir = (value?: string | null): string | undefined => {
      if (!value) return undefined
      let cleaned = value.replace(/[\\]+/g, '/').replace(/^\/+/, '')
      if (!cleaned) return undefined
      if (cleaned.startsWith('workspace/')) {
        cleaned = cleaned.replace(/^workspace\//, '')
      }
      return cleaned || undefined
    }

    const sanitize = (value?: string | null) => {
      if (!value) return undefined
      return value.toString().trim().replace(/[<>:"/\\|?*]+/g, '_')
    }

    for (const entry of coreResult.results) {
      if (!entry?.report) continue
      const testName = entry.report?.caseName || entry.className || 'TestCase'
      try {
        const normalizedUserDir = normalizeUserDir(entry.report?.metadata?.userDir)
        const reportWorkspaceBase = normalizedUserDir
          ? path.join(workspaceRoot, normalizedUserDir, 'reports')
          : path.join(workspaceRoot, 'reports')

        const platform = sanitize(
          entry.report?.metadata?.platform ?? meta?.platform ?? entry.report?.metadata?.workspacePlatform,
        )
        const moduleName = sanitize(
          entry.report?.metadata?.module ?? meta?.module ?? entry.report?.metadata?.workspaceModule,
        )
        const caseName = sanitize(
          entry.report?.metadata?.caseName ?? meta?.caseName ?? testName,
        )
        const reportWorkspace =
          platform && moduleName
            ? path.join(reportWorkspaceBase, platform, moduleName, caseName || 'case')
            : caseName
              ? path.join(reportWorkspaceBase, caseName)
              : reportWorkspaceBase

        entry.report.metadata = {
          ...(entry.report.metadata ?? {}),
          userDir: normalizedUserDir ?? undefined,
          platform: platform ?? entry.report?.metadata?.platform,
          module: moduleName ?? entry.report?.metadata?.module,
          caseName: caseName ?? testName,
        }

        await this.reportService.generate(reportWorkspace, testName, entry.report)
      } catch (generateErr) {
        this.logger.error(`Failed to generate report for ${testName}: ${generateErr}`)
      }
    }
  }
  async loadCoreLib() {
    // Prefer ESM build (supports TLA); fallback to CJS
    const coreDir = path.join(
      __dirname,
      '../..',
      process.env.CORE_LIB_DIR || 'workspace/shared-libs/core'
    )
    const coreLibPath = path.join(coreDir, 'dist/index.js')
    const coreSrcDir = path.join(coreDir, 'src')
    // If dist is missing or older than src, rebuild automatically
    try {
      const distExists =
        fs.existsSync(coreLibPath) || fs.existsSync(coreLibPath.replace(/index\.js$/, 'index.mjs'))
      const srcLatest = await this.getDirLatestMtimeSafe(coreSrcDir)
      const distLatest =
        (await this.getFileMtimeSafe(coreLibPath)) ||
        (await this.getFileMtimeSafe(coreLibPath.replace(/index\.js$/, 'index.mjs')))
      if (!distExists || (srcLatest && distLatest && srcLatest > distLatest)) {
        this.logger.info('Core lib dist outdated or missing. Rebuilding...')
        await this.buildCoreLib()
      }
    } catch {}
    try {
      const coreLibPathMjs = coreLibPath.replace(/index\.js$/, 'index.mjs')
      const filePathUsed = fs.existsSync(coreLibPathMjs) ? coreLibPathMjs : coreLibPath
      if (!fs.existsSync(filePathUsed)) {
        throw new Error(`core-lib not found at ${coreLibPath}. Please generate core-lib first.`)
      }
      // 获取文件的修改时间
      const stats = fs.statSync(filePathUsed)
      const currentModifiedTime = stats.mtimeMs
      // 如果模块已缓存且修改时间未变，返回缓存的模块
      if (this.coreModule && this.coreModuleLastUpdate === currentModifiedTime) {
        return this.coreModule
      }

      // 文件已更改，重新加载模块
      console.log(`Reloading core-lib from ${filePathUsed}`)
      // 支持 ESM/CJS：优先 ESM（有 require shim），回退 CJS
      const distIndexMjs = coreLibPathMjs
      let module: any
      const dynamicImport = (p: string) => new Function('p', 'return import(p)')(p) as Promise<any>
      try {
        if (fs.existsSync(distIndexMjs)) {
          // 用唯一文件名规避 ESM 缓存，并保持 file:// 方案，保证 createRequire(import.meta.url) 可用
          const dir = path.dirname(distIndexMjs)
          const ts = Math.floor(currentModifiedTime)
          const basename = `index-${ts}.mjs`
          const uniquePath = path.join(dir, basename)
          // 清理旧的临时 mjs
          try {
            for (const f of fs.readdirSync(dir)) {
              if (/^index-\d+\.mjs$/.test(f)) {
                try {
                  fs.unlinkSync(path.join(dir, f))
                } catch {}
              }
            }
          } catch {}
          fs.copyFileSync(distIndexMjs, uniquePath)
          const { pathToFileURL } = require('url')
          const href = pathToFileURL(uniquePath).href
          module = await dynamicImport(href)
        } else if (fs.existsSync(coreLibPath)) {
          this.deepClearCache(coreLibPath)
          module = require(coreLibPath)
        }
      } catch (e) {
        // 回退到 CJS
        if (fs.existsSync(coreLibPath)) {
          this.deepClearCache(coreLibPath)
          module = require(coreLibPath)
        } else {
          throw e
        }
      }
      // 更新缓存和修改时间
      this.coreModule = module
      this.coreModuleLastUpdate = currentModifiedTime

      return module
    } catch (error) {
      console.error('Failed to load core-lib:', error)
      throw error
    }
  }
  async loadGettrWebLib() {
    // Prefer ESM build; fallback to CJS
    const gettrDir = path.join(
      __dirname,
      '../..',
      process.env.GETTR_LIB_DIR || 'workspace/shared-libs/gettr-web'
    )
    const gettrLibPath = path.join(gettrDir, 'dist/index.js')
    const gettrSrcDir = path.join(gettrDir, 'src')
    // Auto rebuild if outdated
    try {
      const distExists =
        fs.existsSync(gettrLibPath) ||
        fs.existsSync(gettrLibPath.replace(/index\.js$/, 'index.mjs'))
      const srcLatest = await this.getDirLatestMtimeSafe(gettrSrcDir)
      const distLatest =
        (await this.getFileMtimeSafe(gettrLibPath)) ||
        (await this.getFileMtimeSafe(gettrLibPath.replace(/index\.js$/, 'index.mjs')))
      if (!distExists || (srcLatest && distLatest && srcLatest > distLatest)) {
        this.logger.info('gettr web lib dist outdated or missing. Rebuilding...')
        await this.buildGettrWebLib()
      }
    } catch {}
    try {
      const gettrLibPathMjs = gettrLibPath.replace(/index\.js$/, 'index.mjs')
      const filePathUsed = fs.existsSync(gettrLibPathMjs) ? gettrLibPathMjs : gettrLibPath
      if (!fs.existsSync(filePathUsed)) {
        throw new Error(
          `gettr-web-lib not found at ${gettrLibPath}. Please generate gettr-lib first.`
        )
      }
      // 获取文件的修改时间
      const stats = fs.statSync(filePathUsed)
      const currentModifiedTime = stats.mtimeMs
      // 如果模块已缓存且修改时间未变，返回缓存的模块
      if (this.gettrWebModule && this.gettrWebModuleLastUpdate === currentModifiedTime) {
        return this.gettrWebModule
      }

      // 文件已更改，重新加载模块
      console.log(`Reloading gettr-web-lib from ${filePathUsed}`)
      const distIndexMjs = gettrLibPathMjs
      let module: any
      const dynamicImport = (p: string) => new Function('p', 'return import(p)')(p) as Promise<any>
      try {
        if (fs.existsSync(distIndexMjs)) {
          const dir = path.dirname(distIndexMjs)
          const ts = Math.floor(currentModifiedTime)
          const basename = `index-${ts}.mjs`
          const uniquePath = path.join(dir, basename)
          try {
            for (const f of fs.readdirSync(dir)) {
              if (/^index-\d+\.mjs$/.test(f)) {
                try {
                  fs.unlinkSync(path.join(dir, f))
                } catch {}
              }
            }
          } catch {}
          fs.copyFileSync(distIndexMjs, uniquePath)
          const { pathToFileURL } = require('url')
          const href = pathToFileURL(uniquePath).href
          module = await dynamicImport(href)
        } else if (fs.existsSync(gettrLibPath)) {
          this.deepClearCache(gettrLibPath)
          module = require(gettrLibPath)
        }
      } catch (e) {
        if (fs.existsSync(gettrLibPath)) {
          this.deepClearCache(gettrLibPath)
          module = require(gettrLibPath)
        } else {
          throw e
        }
      }
      // 更新缓存和修改时间
      this.gettrWebModule = module
      this.gettrWebModuleLastUpdate = currentModifiedTime

      return module
    } catch (error) {
      console.error('Failed to load gettr-web-lib:', error)
      throw error
    }
  }

  async loadGettrMobileWebLib() {
    // Prefer ESM build; fallback to CJS
    const mobileWebDir = path.join(
      __dirname,
      '../..',
      process.env.GETTR_MOBILE_WEB_LIB_DIR || 'workspace/shared-libs/gettr-mobile-web'
    )
    const libPath = path.join(mobileWebDir, 'dist/index.js')
    const srcDir = path.join(mobileWebDir, 'src')
    // Auto rebuild if outdated
    try {
      const distExists =
        fs.existsSync(libPath) || fs.existsSync(libPath.replace(/index\.js$/, 'index.mjs'))
      const srcLatest = await this.getDirLatestMtimeSafe(srcDir)
      const distLatest =
        (await this.getFileMtimeSafe(libPath)) ||
        (await this.getFileMtimeSafe(libPath.replace(/index\.js$/, 'index.mjs')))
      if (!distExists || (srcLatest && distLatest && srcLatest > distLatest)) {
        this.logger.info('gettr-mobile-web lib dist outdated or missing. Rebuilding...')
        await this.buildGettrMobileWebLib()
      }
    } catch {}
    try {
      const libPathMjs = libPath.replace(/index\.js$/, 'index.mjs')
      const filePathUsed = fs.existsSync(libPathMjs) ? libPathMjs : libPath
      if (!fs.existsSync(filePathUsed)) {
        throw new Error(
          `gettr-mobile-web-lib not found at ${libPath}. Please generate gettr-mobile-web-lib first.`
        )
      }
      const stats = fs.statSync(filePathUsed)
      const currentModifiedTime = stats.mtimeMs
      if (
        this.gettrMobileWebModule &&
        this.gettrMobileWebModuleLastUpdate === currentModifiedTime
      ) {
        return this.gettrMobileWebModule
      }

      console.log(`Reloading gettr-mobile-web-lib from ${filePathUsed}`)
      const distIndexMjs = libPathMjs
      let module: any
      const dynamicImport = (p: string) => new Function('p', 'return import(p)')(p) as Promise<any>
      try {
        if (fs.existsSync(distIndexMjs)) {
          const dir = path.dirname(distIndexMjs)
          const ts = Math.floor(currentModifiedTime)
          const basename = `index-${ts}.mjs`
          const uniquePath = path.join(dir, basename)
          try {
            for (const f of fs.readdirSync(dir)) {
              if (/^index-\d+\.mjs$/.test(f)) {
                try {
                  fs.unlinkSync(path.join(dir, f))
                } catch {}
              }
            }
          } catch {}
          fs.copyFileSync(distIndexMjs, uniquePath)
          const { pathToFileURL } = require('url')
          const href = pathToFileURL(uniquePath).href
          module = await dynamicImport(href)
        } else if (fs.existsSync(libPath)) {
          this.deepClearCache(libPath)
          module = require(libPath)
        }
      } catch (e) {
        if (fs.existsSync(libPath)) {
          this.deepClearCache(libPath)
          module = require(libPath)
        } else {
          throw e
        }
      }
      this.gettrMobileWebModule = module
      this.gettrMobileWebModuleLastUpdate = currentModifiedTime
      return module
    } catch (error) {
      console.error('Failed to load gettr-mobile-web-lib:', error)
      throw error
    }
  }
  async loadGettrAndroidLib() {
    // Prefer ESM build; fallback to CJS
    const gettrAndroidDir = path.join(
      __dirname,
      '../..',
      process.env.GETTR_ANDROID_LIB_DIR || 'workspace/shared-libs/gettr-android'
    )
    const gettrLibPath = path.join(gettrAndroidDir, 'dist/index.js')
    const gettrSrcDir = path.join(gettrAndroidDir, 'src')
    // Auto rebuild if outdated
    try {
      const distExists =
        fs.existsSync(gettrLibPath) ||
        fs.existsSync(gettrLibPath.replace(/index\.js$/, 'index.mjs'))
      const srcLatest = await this.getDirLatestMtimeSafe(gettrSrcDir)
      const distLatest =
        (await this.getFileMtimeSafe(gettrLibPath)) ||
        (await this.getFileMtimeSafe(gettrLibPath.replace(/index\.js$/, 'index.mjs')))
      if (!distExists || (srcLatest && distLatest && srcLatest > distLatest)) {
        this.logger.info('gettr-android lib dist outdated or missing. Rebuilding...')
        await this.buildGettrAndroidLib()
      }
    } catch {}
    try {
      const gettrLibPathMjs = gettrLibPath.replace(/index\.js$/, 'index.mjs')
      const filePathUsed = fs.existsSync(gettrLibPathMjs) ? gettrLibPathMjs : gettrLibPath
      if (!fs.existsSync(filePathUsed)) {
        throw new Error(
          `gettr-android-lib not found at ${gettrLibPath}. Please generate gettr-android-lib first.`
        )
      }
      // 获取文件的修改时间
      const stats = fs.statSync(filePathUsed)
      const currentModifiedTime = stats.mtimeMs
      // 如果模块已缓存且修改时间未变，返回缓存的模块
      if (this.gettrAndroidModule && this.gettrAndroidModuleLastUpdate === currentModifiedTime) {
        return this.gettrAndroidModule
      }

      // 文件已更改，重新加载模块
      console.log(`Reloading gettr-android-lib from ${filePathUsed}`)
      const distIndexMjs = gettrLibPathMjs
      let module: any
      const dynamicImport = (p: string) => new Function('p', 'return import(p)')(p) as Promise<any>
      try {
        if (fs.existsSync(distIndexMjs)) {
          const dir = path.dirname(distIndexMjs)
          const ts = Math.floor(currentModifiedTime)
          const basename = `index-${ts}.mjs`
          const uniquePath = path.join(dir, basename)
          try {
            for (const f of fs.readdirSync(dir)) {
              if (/^index-\d+\.mjs$/.test(f)) {
                try {
                  fs.unlinkSync(path.join(dir, f))
                } catch {}
              }
            }
          } catch {}
          fs.copyFileSync(distIndexMjs, uniquePath)
          const { pathToFileURL } = require('url')
          const href = pathToFileURL(uniquePath).href
          module = await dynamicImport(href)
        } else if (fs.existsSync(gettrLibPath)) {
          this.deepClearCache(gettrLibPath)
          module = require(gettrLibPath)
        }
      } catch (e) {
        if (fs.existsSync(gettrLibPath)) {
          this.deepClearCache(gettrLibPath)
          module = require(gettrLibPath)
        } else {
          throw e
        }
      }
      // 更新缓存和修改时间
      this.gettrAndroidModule = module
      this.gettrAndroidModuleLastUpdate = currentModifiedTime

      return module
    } catch (error) {
      console.error('Failed to load gettr-android-lib:', error)
      throw error
    }
  }

  async buildGettrWebLib(clientId?: string) {
    console.log('libdir:', process.env.GETTR_LIB_DIR)

    const coreDir = path.join(
      __dirname,
      '../..',
      process.env.GETTR_LIB_DIR || 'workspace/shared-libs/gettr-web'
    )

    const outputDir = path.join(coreDir, 'dist')
    const srcDir = path.join(coreDir, 'src')
    const indexPath = path.join(coreDir, 'index.ts')
    this.logger.debug(
      `coredir: ${coreDir}, outDir:${outputDir}, srcDir:${srcDir}, indexPath:${indexPath}`
    )
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
    fs.mkdirSync(outputDir, { recursive: true })
    this.generateIndexWithTsMorph(coreDir, srcDir, indexPath)
    const result = await this.buildWithEsbuild(indexPath, outputDir)
    try {
      await this.emitDeclarationsWithTsMorph(coreDir)
    } catch (e) {
      this.logger.warn(`emit d.ts failed for gettr lib: ${e}`)
    }
    clientId && this.logger.sendTo(clientId, `gettr lib ${result}`, 'info')
    // delete the module cache,
    delete require.cache[require.resolve(indexPath)]

    // 清理构建产物的缓存
    // 清理 ESM 产物的缓存无需 require.cache；这里保持向后兼容
    const distIndexJs = path.join(outputDir, 'index.js')
    const distIndexMjs = path.join(outputDir, 'index.mjs')
    this.deepClearCache(distIndexJs)
    this.deepClearCache(distIndexMjs)
  }

  async buildGettrMobileWebLib(clientId?: string) {
    const mobileWebDir = path.join(
      __dirname,
      '../..',
      process.env.GETTR_MOBILE_WEB_LIB_DIR || 'workspace/shared-libs/gettr-mobile-web'
    )
    const outputDir = path.join(mobileWebDir, 'dist')
    const srcDir = path.join(mobileWebDir, 'src')
    const indexPath = path.join(mobileWebDir, 'index.ts')
    this.logger.debug(
      `mobile web lib path: ${mobileWebDir}, outDir:${outputDir}, indexPath:${indexPath}`
    )
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
    fs.mkdirSync(outputDir, { recursive: true })
    await this.generateIndexWithTsMorph(mobileWebDir, srcDir, indexPath)
    const result = await this.buildWithEsbuild(indexPath, outputDir)
    try {
      await this.emitDeclarationsWithTsMorph(mobileWebDir)
    } catch (e) {
      this.logger.warn(`emit d.ts failed for gettr-mobile-web lib: ${e}`)
    }
    clientId && this.logger.sendTo(clientId, `gettr-mobile-web lib ${result}`, 'info')

    delete require.cache[require.resolve(indexPath)]

    const distIndexJs = path.join(outputDir, 'index.js')
    const distIndexMjs = path.join(outputDir, 'index.mjs')
    this.deepClearCache(distIndexJs)
    this.deepClearCache(distIndexMjs)
  }

  private async getDirLatestMtimeSafe(dir: string): Promise<number | undefined> {
    try {
      let latest = 0
      if (!fs.existsSync(dir)) return undefined
      const walk = (d: string) => {
        for (const name of fs.readdirSync(d)) {
          const full = path.join(d, name)
          try {
            const st = fs.statSync(full)
            if (st.isDirectory()) walk(full)
            else if (st.isFile()) latest = Math.max(latest, st.mtimeMs)
          } catch {}
        }
      }
      walk(dir)
      return latest || undefined
    } catch {
      return undefined
    }
  }

  private async getFileMtimeSafe(file: string): Promise<number | undefined> {
    try {
      if (!fs.existsSync(file)) return undefined
      return fs.statSync(file).mtimeMs
    } catch {
      return undefined
    }
  }

  async buildCoreLib(clientId?: string) {
    console.log('libdir:', process.env.CORE_LIB_DIR)
    const coreDir = path.join(
      __dirname,
      '../..',
      process.env.CORE_LIB_DIR || 'workspace/shared-libs/core'
    )
    const outputDir = path.join(coreDir, 'dist')
    const srcDir = path.join(coreDir, 'src')
    const indexPath = path.join(coreDir, 'index.ts')
    // 清空输出目录
    this.logger.debug(`coredir: ${coreDir}, outDir:${outputDir}, indexPath:${indexPath}`)
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
    fs.mkdirSync(outputDir, { recursive: true })
    await this.generateIndexWithTsMorph(coreDir, srcDir, indexPath)
    const result = await this.buildWithEsbuild(indexPath, outputDir)
    try {
      await this.emitDeclarationsWithTsMorph(coreDir)
    } catch (e) {
      this.logger.warn(`emit d.ts failed for core lib: ${e}`)
    }
    clientId && this.logger.sendTo(clientId, `core lib ${result}`, 'info')

    // delete the module cache
    delete require.cache[require.resolve(indexPath)]

    // 清理构建产物的缓存
    const distIndexJs = path.join(outputDir, 'index.js')
    const distIndexMjs = path.join(outputDir, 'index.mjs')
    this.deepClearCache(distIndexJs)
    this.deepClearCache(distIndexMjs)
  }
  async buildGettrAndroidLib(clientId?: string) {
    const androidLibPath = path.join(
      __dirname,
      '../..',
      process.env.GETTR_ANDROID_LIB_DIR || 'workspace/shared-libs/gettr-android'
    )
    const outputDir = path.join(androidLibPath, 'dist')
    const srcDir = path.join(androidLibPath, 'src')
    const indexPath = path.join(androidLibPath, 'index.ts')
    // 清空输出目录
    this.logger.debug(`lib path: ${androidLibPath}, outDir:${outputDir}, indexPath:${indexPath}`)
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
    fs.mkdirSync(outputDir, { recursive: true })
    await this.generateIndexWithTsMorph(androidLibPath, srcDir, indexPath)
    const result = await this.buildWithEsbuild(indexPath, outputDir)
    try {
      await this.emitDeclarationsWithTsMorph(androidLibPath)
    } catch (e) {
      this.logger.warn(`emit d.ts failed for gettr-android lib: ${e}`)
    }
    clientId && this.logger.sendTo(clientId, `gettr-android lib ${result}`, 'info')

    // delete the module cache
    delete require.cache[require.resolve(indexPath)]

    // 清理构建产物的缓存
    const distIndexJs = path.join(outputDir, 'index.js')
    const distIndexMjs = path.join(outputDir, 'index.mjs')
    this.deepClearCache(distIndexJs)
    this.deepClearCache(distIndexMjs)
  }

  async generateIndexWithTsMorph(coreDir: string, srcDir: string, indexPath: string) {
    const project = new Project({
      tsConfigFilePath: path.join(coreDir, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    })

    // Include TS sources but exclude declaration files to avoid duplicate named exports
    project.addSourceFilesAtPaths([`${srcDir}/*.ts`])

    // 收集导出的符号
    const exportStatements: string[] = []
    // Note: `*.ts` glob also matches `*.d.ts`; filter them out explicitly
    const files = [...project.getSourceFiles(`${srcDir}/*.ts`)].filter(
      (f) => !/\.d\.ts$/i.test(f.getFilePath())
    )

    files.forEach((file) => {
      const filePath = file.getFilePath()
      const relativePath = path.relative(coreDir, filePath).replace(/\.ts$/, '')
      const exports = file.getExportSymbols()

      if (exports.length > 0) {
        const exportNames = exports.map((exp) => exp.getName()).join(', ')
        exportStatements.push(`export { ${exportNames} } from './${relativePath}';`)
      }
    })

    const indexContent = `// Auto-generated index.ts for lib\n${exportStatements.join('\n')}`
    fs.writeFileSync(indexPath, indexContent)

    console.log('Generated index.ts using ts-morph')
    console.log('Export statements:', exportStatements)
  }

  async buildWithEsbuild(indexPath: string, outputDir: string) {
    const baseOptions: esbuild.BuildOptions = {
      entryPoints: [indexPath],
      bundle: true,
      outdir: outputDir,
      platform: 'node',
      sourcemap: false,
      minify: false,
      loader: { '.ts': 'ts' },
      write: true,
    }

    try {
      // 1) ESM 构建（支持 TLA），生成 index.mjs，并注入 require shim
      const esmOptions: esbuild.BuildOptions = {
        ...baseOptions,
        format: 'esm',
        outExtension: { '.js': '.mjs' },
        banner: {
          js: [
            "import { createRequire } from 'module';",
            'const require = createRequire(import.meta.url);',
            "import { fileURLToPath } from 'url';",
            "import path from 'path';",
            'const __filename = fileURLToPath(import.meta.url);',
            'const __dirname = path.dirname(__filename);',
          ].join('\n'),
        },
        external: ['node:*'],
      }
      const esmResult = await esbuild.build(esmOptions)
      if (esmResult.errors?.length) console.error('ESM build errors:', esmResult.errors)

      // 2) CJS 构建（兼容无 TLA 环境），生成 index.js
      const cjsOptions: esbuild.BuildOptions = {
        ...baseOptions,
        format: 'cjs',
      }
      const cjsResult = await esbuild.build(cjsOptions)
      if (cjsResult.errors?.length) console.error('CJS build errors:', cjsResult.errors)

      const files = fs.readdirSync(outputDir)
      if (files.length === 0)
        throw new Error(`No files found in ${outputDir}. Build may have failed.`)

      return `build succssfully`
    } catch (error) {
      console.error('Build failed:', error)
    } finally {
      esbuild.stop()
    }
  }
  async buildLibsComplete(clientId: string) {
    this.logger.sendTo(clientId, 'libs build complete')
    this.logger.complete(clientId, 'lbcpt')
  }
  /**
   * Emit TypeScript declaration files (.d.ts) for a lib directory using its tsconfig.json.
   * Writes to the configured declarationDir/outDir in the lib tsconfig (usually ./dist).
   */
  private async emitDeclarationsWithTsMorph(libDir: string) {
    const tsconfig = path.join(libDir, 'tsconfig.json')
    const project = new Project({
      tsConfigFilePath: tsconfig,
      skipAddingFilesFromTsConfig: false,
    })
    // Ensure index.ts exists when ts-morph resolves project files
    // It is generated by generateIndexWithTsMorph before calling this method
    await project.emit({ emitOnlyDtsFiles: true })
  }

  /** Read all .d.ts produced under each lib dist and return as a mapping for the editor. */
  async getTypingsBundle() {
    const libs = [
      {
        name: 'core-lib',
        dir: path.join(
          __dirname,
          '../..',
          process.env.CORE_LIB_DIR || 'workspace/shared-libs/core'
        ),
      },
      {
        name: 'gettr-web-lib',
        dir: path.join(
          __dirname,
          '../..',
          process.env.GETTR_LIB_DIR || 'workspace/shared-libs/gettr-web'
        ),
      },
      {
        name: 'gettr-android-lib',
        dir: path.join(
          __dirname,
          '../..',
          process.env.GETTR_ANDROID_LIB_DIR || 'workspace/shared-libs/gettr-android'
        ),
      },
    ]

    // Ensure d.ts exist by emitting (no-op if already up-to-date)
    for (const l of libs) {
      try {
        await this.emitDeclarationsWithTsMorph(l.dir)
      } catch {}
    }

    const entries: { path: string; content: string }[] = []
    for (const l of libs) {
      const dist = path.join(l.dir, 'dist')
      if (!fs.existsSync(dist)) continue
      const walk = (d: string) => {
        for (const name of fs.readdirSync(d)) {
          const full = path.join(d, name)
          const st = fs.statSync(full)
          if (st.isDirectory()) walk(full)
          else if (st.isFile() && name.endsWith('.d.ts')) {
            const rel = path.relative(l.dir, full).replace(/\\/g, '/')
            const virtualPath = `/types/${l.name}/${rel}`
            try {
              entries.push({
                path: virtualPath,
                content: fs.readFileSync(full, 'utf-8'),
              })
            } catch {}
          }
        }
      }
      walk(dist)
    }
    // Ensure each lib has a virtual dist/index.d.ts that re-exports its declarations
    const byLib: Record<string, string[]> = {}
    for (const e of entries) {
      const m = e.path.match(/^\/types\/([^/]+)\/dist\/(.+)$/)
      if (!m) continue
      const lib = m[1]
      byLib[lib] = byLib[lib] || []
      byLib[lib].push(e.path)
    }
    for (const lib of Object.keys(byLib)) {
      const base = `/types/${lib}`
      const indexPath = `${base}/dist/index.d.ts`
      const files = byLib[lib]
      const rels: string[] = []
      for (const p of files) {
        const m2 = p.match(/^\/types\/[^/]+\/dist\/(.+)$/)
        if (!m2) continue
        // Prefer src/*.d.ts first, then others
        rels.push(m2[1])
      }
      // put likely entry first if present
      const pri = rels.sort((a, b) => {
        const score = (s: string) =>
          s === 'index.d.ts' ? 0 : s === 'src/index.d.ts' ? 1 : s.startsWith('src/') ? 2 : 3
        return score(a) - score(b)
      })

      let content = ''

      // Special handling for gettr-android-lib: also expose per-branch and per-language
      // namespaces, e.g.:
      //   export * as release_1_73_0 from './src/release-1.73.0';
      //   export * as release_1_73_0_en from './src/release-1.73.0/en';
      if (lib === 'gettr-android-lib') {
        const nsLines: string[] = []
        const nsLangLines: string[] = []
        for (const r of pri) {
          // Branch-level index: src/<branch>/index.d.ts
          const mBranch = r.match(/^src\/([^/]+)\/index\.d\.ts$/)
          if (mBranch) {
            const branch = mBranch[1] // e.g. release-1.73.0
            let ns = branch.replace(/[^A-Za-z0-9]+/g, '_')
            if (!/^[A-Za-z_]/.test(ns)) {
              ns = `v_${ns}`
            }
            nsLines.push(`export * as ${ns} from './src/${branch}';`)
            continue
          }

          // Branch + language index: src/<branch>/<lang>/index.d.ts
          const mLang = r.match(/^src\/([^/]+)\/([^/]+)\/index\.d\.ts$/)
          if (mLang) {
            const branch = mLang[1]
            const lang = mLang[2]
            let baseNs = branch.replace(/[^A-Za-z0-9]+/g, '_')
            if (!/^[A-Za-z_]/.test(baseNs)) {
              baseNs = `v_${baseNs}`
            }
            let langNs = lang.replace(/[^A-Za-z0-9]+/g, '_')
            if (!/^[A-Za-z_]/.test(langNs)) {
              langNs = `v_${langNs}`
            }
            const ns = `${baseNs}_${langNs}`
            nsLangLines.push(`export * as ${ns} from './src/${branch}/${lang}';`)
          }
        }
        if (nsLines.length || nsLangLines.length) {
          content += [...nsLines, ...nsLangLines].join('\n') + '\n'
        }
      }

      const exportLines = pri.map((r) => `export * from './${r.replace(/'/g, "'")}'`)
      content += exportLines.join('\n') + '\n'

      // Always push/overwrite index.d.ts for each lib; later entries win in the editor.
      entries.push({ path: indexPath, content })
    }
    return { files: entries }
  }

  async cleanupKeptAndroidSessions() {
    const drivers: Map<string, any> | undefined = (globalThis as any).__androidDrivers
    if (!drivers || drivers.size === 0) {
      return { closed: 0, errors: 0, kept: 0 }
    }
    let closed = 0
    let errors = 0
    const kept = drivers.size
    for (const [key, driver] of Array.from(drivers.entries())) {
      try {
        await driver?.deleteSession?.()
        closed += 1
      } catch (e) {
        errors += 1
        this.logger.warn(`Failed to close driver ${key}: ${e}`)
      } finally {
        try {
          drivers.delete(key)
        } catch {}
      }
    }
    return { closed, errors, kept }
  }

  async cleanupKeptAndroidSessionsFor(clientId: string) {
    if (!clientId) {
      return { closed: 0, errors: 0, kept: 0 }
    }
    const drivers: Map<string, any> | undefined = (globalThis as any).__androidDrivers
    if (!drivers || drivers.size === 0) {
      return { closed: 0, errors: 0, kept: 0 }
    }
    const prefix = `${clientId}:`
    const sharePrefix = `share:${clientId}`
    let closed = 0
    let errors = 0
    let kept = 0
    for (const [key, driver] of Array.from(drivers.entries())) {
      if (!(key.startsWith(prefix) || key === sharePrefix)) {
        kept += 1
        continue
      }
      try {
        await driver?.deleteSession?.()
        closed += 1
      } catch (e) {
        errors += 1
        this.logger.warn(`Failed to close driver ${key}: ${e}`)
      } finally {
        try {
          drivers.delete(key)
        } catch {}
      }
    }
    return { closed, errors, kept }
  }

  async cleanupSharedSessionByKey(sessionKey: string) {
    if (!sessionKey) return { closed: 0, errors: 0, kept: 0 }
    const drivers: Map<string, any> | undefined = (globalThis as any).__androidDrivers
    if (!drivers || drivers.size === 0) return { closed: 0, errors: 0, kept: 0 }
    const key = `share:${sessionKey}`
    let closed = 0
    let errors = 0
    let kept = drivers.size
    const drv = drivers.get(key)
    if (!drv) return { closed: 0, errors: 0, kept }
    try {
      await drv?.deleteSession?.()
      closed = 1
    } catch (e) {
      errors = 1
      this.logger.warn(`Failed to close driver ${key}: ${e}`)
    } finally {
      try {
        drivers.delete(key)
      } catch {}
    }
    kept = drivers.size
    return { closed, errors, kept }
  }
}
