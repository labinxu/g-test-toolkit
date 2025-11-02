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
import { getErrorMessage } from 'src/common/utils'
import { BrowserHelper } from 'src/browser/browser-helper'
@Injectable()
export class TestCasesService {
  private logger: CustomLogger
  private coreModule = null
  private coreModuleLastUpdate = null
  private gettrModule = null
  private gettrModuleLastUpdate = null
  private gettrAndroidModule: any = null
  private gettrAndroidModuleLastUpdate: number | null = null
  constructor(
    private readonly loggerService: LoggerService,
    private readonly androidService: AndroidService,
    private readonly reportService: ReportService
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
  async getInterfaces() {
    const coreLibPath = path.join(
      __dirname,
      '../..',
      process.env.CORE_LIB_DIR || 'workspace/shared-libs/core',
      'index.ts'
    )
    const gettrLibPath = path.join(
      __dirname,
      '../..',
      process.env.GETTR_LIB_DIR || 'workspace/shared-libs/gettr',
      'index.ts'
    )
    const androidLibPath = path.join(
      __dirname,
      '../..',
      process.env.GETTR_ANDROID_LIB_DIR || 'workspace/shared-libs/gettr-android',
      'index.ts'
    )

    this.logger.info(`corelib:${coreLibPath}\ngettrlib:${gettrLibPath}`)
    try {
      const coreInterface = fs.readFileSync(coreLibPath, 'utf-8')
      const gettrInterface = fs.readFileSync(gettrLibPath, 'utf-8')
      const gettrAndroidInterface = fs.readFileSync(androidLibPath, 'utf-8')
      return [
        { 'core-lib': coreInterface },
        { 'gettr-lib': gettrInterface },
        { 'android-lib': gettrAndroidInterface },
      ]
    } catch (err) {
      this.logger.error(getErrorMessage(err))
      throw err
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
  async runInSandbox(
    code: string,
    clientId?: string,
    options?: {
      keepAppOpen?: boolean
      shareSession?: boolean
      sessionKey?: string
    }
  ): Promise<any> {
    let transformedCode = ''
    let coreLib: any
    let gettrLib: any
    let gettrAndroidLib: any
    try {
      transformedCode = await this.transformCode(code)
      // 加载 core-lib
      coreLib = await this.loadCoreLib()
      gettrLib = await this.loadGettrLib()
      gettrAndroidLib = await this.loadGettrAndroidLib()
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
        if (moduleName === 'gettr-lib') {
          return gettrLib
        }
        if (moduleName === 'android-lib') {
          return gettrAndroidLib
        }
        return require(moduleName)
        //throw new Error(`Module ${moduleName} not found in sandbox`);
      },
      module: { exports: {} },
      exports: {},
      params: {
        workspace: process.env.WORKSPACE,
        clientId,
        loggerService: this.loggerService,
        browserHelper: new BrowserHelper(),
        options: {
          keepAppOpen: options?.keepAppOpen,
          shareSession: options?.shareSession,
          sessionKey: options?.sessionKey,
        },
      }, // 注入传入的参数
      console, // 注入 console 以支持 console.log
      coreMain: coreLib.main,
    }
    // 创建隔离的上下文
    const context = vm.createContext(sandbox)
    // 包装代码
    const wrappedCode = `
      ${transformedCode}
      coreMain(params)
    `

    try {
      const script = new vm.Script(wrappedCode, { filename: 'testcase.js' })
      script.runInContext(context)
      return context.result // 返回结果
    } catch (error) {
      console.error('Sandbox execution failed:', error)
      throw error
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
      const distExists = fs.existsSync(coreLibPath) || fs.existsSync(coreLibPath.replace(/index\.js$/, 'index.mjs'))
      const srcLatest = await this.getDirLatestMtimeSafe(coreSrcDir)
      const distLatest = await this.getFileMtimeSafe(coreLibPath) || (await this.getFileMtimeSafe(coreLibPath.replace(/index\.js$/, 'index.mjs')))
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
      const dynamicImport = (p: string) => (new Function('p', 'return import(p)'))(p) as Promise<any>
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
                try { fs.unlinkSync(path.join(dir, f)) } catch {}
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
  async loadGettrLib() {
    // Prefer ESM build; fallback to CJS
    const gettrDir = path.join(
      __dirname,
      '../..',
      process.env.GETTR_LIB_DIR || 'workspace/shared-libs/gettr'
    )
    const gettrLibPath = path.join(gettrDir, 'dist/index.js')
    const gettrSrcDir = path.join(gettrDir, 'src')
    // Auto rebuild if outdated
    try {
      const distExists = fs.existsSync(gettrLibPath) || fs.existsSync(gettrLibPath.replace(/index\.js$/, 'index.mjs'))
      const srcLatest = await this.getDirLatestMtimeSafe(gettrSrcDir)
      const distLatest = await this.getFileMtimeSafe(gettrLibPath) || (await this.getFileMtimeSafe(gettrLibPath.replace(/index\.js$/, 'index.mjs')))
      if (!distExists || (srcLatest && distLatest && srcLatest > distLatest)) {
        this.logger.info('gettr lib dist outdated or missing. Rebuilding...')
        await this.buildGettrLib()
      }
    } catch {}
    try {
      const gettrLibPathMjs = gettrLibPath.replace(/index\.js$/, 'index.mjs')
      const filePathUsed = fs.existsSync(gettrLibPathMjs) ? gettrLibPathMjs : gettrLibPath
      if (!fs.existsSync(filePathUsed)) {
        throw new Error(`gettr-lib not found at ${gettrLibPath}. Please generate gettr-lib first.`)
      }
      // 获取文件的修改时间
      const stats = fs.statSync(filePathUsed)
      const currentModifiedTime = stats.mtimeMs
      // 如果模块已缓存且修改时间未变，返回缓存的模块
      if (this.gettrAndroidModule && this.gettrAndroidModuleLastUpdate === currentModifiedTime) {
        return this.gettrAndroidModule
      }

      // 文件已更改，重新加载模块
      console.log(`Reloading gettr-lib from ${filePathUsed}`)
      const distIndexMjs = gettrLibPathMjs
      let module: any
      const dynamicImport = (p: string) => (new Function('p', 'return import(p)'))(p) as Promise<any>
      try {
        if (fs.existsSync(distIndexMjs)) {
          const dir = path.dirname(distIndexMjs)
          const ts = Math.floor(currentModifiedTime)
          const basename = `index-${ts}.mjs`
          const uniquePath = path.join(dir, basename)
          try {
            for (const f of fs.readdirSync(dir)) {
              if (/^index-\d+\.mjs$/.test(f)) {
                try { fs.unlinkSync(path.join(dir, f)) } catch {}
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
      console.error('Failed to load gettr-lib:', error)
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
      const distExists = fs.existsSync(gettrLibPath) || fs.existsSync(gettrLibPath.replace(/index\.js$/, 'index.mjs'))
      const srcLatest = await this.getDirLatestMtimeSafe(gettrSrcDir)
      const distLatest = await this.getFileMtimeSafe(gettrLibPath) || (await this.getFileMtimeSafe(gettrLibPath.replace(/index\.js$/, 'index.mjs')))
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
      if (this.gettrModule && this.gettrModuleLastUpdate === currentModifiedTime) {
        return this.gettrModule
      }

      // 文件已更改，重新加载模块
      console.log(`Reloading gettr-android-lib from ${filePathUsed}`)
      const distIndexMjs = gettrLibPathMjs
      let module: any
      const dynamicImport = (p: string) => (new Function('p', 'return import(p)'))(p) as Promise<any>
      try {
        if (fs.existsSync(distIndexMjs)) {
          const dir = path.dirname(distIndexMjs)
          const ts = Math.floor(currentModifiedTime)
          const basename = `index-${ts}.mjs`
          const uniquePath = path.join(dir, basename)
          try {
            for (const f of fs.readdirSync(dir)) {
              if (/^index-\d+\.mjs$/.test(f)) {
                try { fs.unlinkSync(path.join(dir, f)) } catch {}
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
      this.gettrModule = module
      this.gettrModuleLastUpdate = currentModifiedTime

      return module
    } catch (error) {
      console.error('Failed to load gettr-android-lib:', error)
      throw error
    }
  }

  async buildGettrLib(clientId?: string) {
    console.log('libdir:', process.env.GETTR_LIB_DIR)

    const coreDir = path.join(
      __dirname,
      '../..',
      process.env.GETTR_LIB_DIR || 'workspace/shared-libs/gettr'
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
    console.log('libdir:', process.env.CORE_LIB_DIR)
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

    project.addSourceFilesAtPaths([`${srcDir}/*.ts`])

    // 收集导出的符号
    const exportStatements: string[] = []
    const files = [...project.getSourceFiles(`${srcDir}/*.ts`)]

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
            "const require = createRequire(import.meta.url);",
            "import { fileURLToPath } from 'url';",
            "import path from 'path';",
            "const __filename = fileURLToPath(import.meta.url);",
            "const __dirname = path.dirname(__filename);",
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
      if (files.length === 0) throw new Error(`No files found in ${outputDir}. Build may have failed.`)
      console.log(`Built lib to ${outputDir}:`, files)

      return `build succssfully`
    } catch (error) {
      console.error('Build failed:', error)
    } finally {
      esbuild.stop()
    }
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
        try { drivers.delete(key) } catch {}
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
        try { drivers.delete(key) } catch {}
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
      try { drivers.delete(key) } catch {}
    }
    kept = drivers.size
    return { closed, errors, kept }
  }
}
