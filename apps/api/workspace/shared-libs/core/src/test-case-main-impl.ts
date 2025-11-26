import { __testCaseClasses } from './test-case-decorator'
import { TestCase } from './test-case-base'
import { remote } from 'webdriverio'
import { spawnSync } from 'child_process'
import { clearBddSuites, createBddTestCaseClasses } from './test-case-bdd'

// Small utilities
const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms || 0)))
async function waitForAppiumServer(
  server: {
    protocol?: string
    hostname?: string
    port?: number
    path?: string
  },
  logger: any,
  totalTimeoutMs = 15000,
) {
  const proto = (server?.protocol || 'http').replace(/:$/, '')
  const host = server?.hostname || '127.0.0.1'
  const port = server?.port || 4723
  const basePath = server?.path || '/'
  const url = `${proto}://${host}:${port}${basePath.endsWith('/') ? basePath : basePath + '/'}status`
  const start = Date.now()
  let attempt = 0
  while (Date.now() - start < totalTimeoutMs) {
    attempt += 1
    try {
      const res = await fetch(url, { method: 'GET' } as any)
      if (res.ok) {
        logger.debug?.(`Appium status OK after ${attempt} attempt(s) at ${url}`)
        return true
      }
      logger.debug?.(`Appium status HTTP ${res.status}`)
    } catch (e) {
      logger.debug?.(`Appium status error: ${e}`)
    }
    await sleep(1000)
  }
  logger.warn?.(`Appium status not confirmed within ${totalTimeoutMs}ms at ${url}`)
  return false
}

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? (value as Record<string, any>) : {}


function withAndroidTimeoutDefaults(caps: Record<string, any>) {
  const out = { ...caps }
  const setIfMissing = (k: string, v: any) => {
    if (out[k] === undefined || out[k] === null) out[k] = v
  }
  setIfMissing('appium:automationName', 'UiAutomator2')
  setIfMissing('appium:newCommandTimeout', 180)
  setIfMissing('appium:adbExecTimeout', 200000)
  setIfMissing('appium:uiautomator2ServerInstallTimeout', 120000)
  setIfMissing('appium:uiautomator2ServerLaunchTimeout', 60000)
  setIfMissing('appium:appWaitDuration', 120000)
  setIfMissing('appium:appWaitActivity', '*')
  setIfMissing('appium:waitForIdleTimeout', 0)
  setIfMissing('appium:disableWindowAnimation', true)
  setIfMissing('appium:autoGrantPermissions', true)
  setIfMissing('appium:ignoreHiddenApiPolicyError', true)
  return out
}

export type MainOptions = {
  keepAppOpen?: boolean
  shareSession?: boolean
  sessionKey?: string
  userDir?: string
  shouldStop?: () => boolean
  envConfig?: any
}

// TestCase requires (logger, clientId, workspace) per TestCase constructor
type TestCaseConstructor = new (logger: any, clientId: string, workspace: string) => TestCase

function prepareBddTestCaseClasses() {
  try {
    const bddClasses = createBddTestCaseClasses()
    if (bddClasses.length) {
      for (const ctor of bddClasses) {
        __testCaseClasses.push(ctor as any)
      }
    }
  } finally {
    clearBddSuites()
  }
}

async function setupAndroidForTestCaseInstance(params: {
  Ctor: any
  instance: any
  logger: any
  androidOpts: any
  shareSession: boolean
  keepAndroidOpen: boolean
  sessionKey?: string
  clientId: string
}) {
  const { Ctor, instance, logger, androidOpts, shareSession, keepAndroidOpen, sessionKey, clientId } =
    params

  ;(globalThis as any).__androidDrivers = (globalThis as any).__androidDrivers || new Map()
  const store: Map<string, any> = (globalThis as any).__androidDrivers
  const key = shareSession
    ? `share:${sessionKey || 'default'}`
    : `${clientId || 'default'}:${Ctor.name}`
  let installModeForThisRun: 'install' | 'launch' =
    (Ctor as any).__androidInstallBehavior ?? 'install'
  logger.info(`android run mode decided: ${installModeForThisRun}`)

  let driver = shareSession ? store.get(key) : undefined

  const createAndroidDriver = async (
    reason: 'initial' | 'recreate',
  ): Promise<{ driver: any; installMode: 'install' | 'launch' }> => {
    let installMode: 'install' | 'launch' = (Ctor as any).__androidInstallBehavior ?? 'install'

    const server = (Ctor as any).__androidServer || {
      protocol: androidOpts?.protocol,
      hostname: androidOpts?.hostname,
      port: androidOpts?.port,
      path: androidOpts?.path,
    }
    const capsInstall = (Ctor as any).__androidCapsInstall || androidOpts?.capabilities
    const capsLaunch = (Ctor as any).__androidCapsLaunch

    if (installMode === 'launch' && !capsLaunch) {
      logger.warn('直启模式缺少 appPackage/appActivity，回退为安装模式')
      installMode = 'install'
    }

    const selectedCaps = installMode === 'launch' ? capsLaunch : capsInstall
    if (!selectedCaps) {
      if (installMode === 'launch') {
        throw new Error(
          'Launch 模式需要提供 appPackage 与 appActivity（@withAndroid），或改为 install 模式并提供 apk',
        )
      }
      throw new Error(
        'Install 模式需要提供 apk（@withAndroid），或改为 launch 模式并提供 appPackage/appActivity',
      )
    }

    // Pre-uninstall conflicting packages when using install mode
    try {
      const preUnPkgs: string[] | undefined = (Ctor as any).__androidPreUninstall
      const doPreUn = (Ctor as any).__androidPreUninstallOnInstall !== false
      const udid: string | undefined =
        selectedCaps['appium:udid'] ||
        selectedCaps['udid'] ||
        androidOpts?.capabilities?.['appium:udid']
      if (installMode === 'install' && doPreUn && udid) {
        // Try to derive package name from APK via aapt if available
        const apkPath: string | undefined = selectedCaps['appium:app']
        let derivedPkg: string | undefined = undefined
        if (apkPath && typeof apkPath === 'string') {
          try {
            const aaptBin = process.env.AAPT_BIN || 'aapt'
            const r = spawnSync(aaptBin, ['dump', 'badging', apkPath], {
              stdio: 'pipe',
              encoding: 'utf-8',
            })
            const out = (r.stdout || '').toString()
            const m = /package:\s+name='([^']+)'/.exec(out)
            if (r.status === 0 && m && m[1]) {
              derivedPkg = m[1]
              logger.info?.(`aapt derived package: ${derivedPkg}`)
            } else {
              const err = (r.stderr || '').toString()
              logger.debug?.(
                `aapt parse failed code=${r.status} out=${out?.slice(0, 200)} err=${err?.slice(0, 200)}`,
              )
            }
          } catch (e) {
            logger.debug?.(`aapt not available or failed: ${e}`)
          }
        }

        const pkgsBase = Array.isArray(preUnPkgs) ? preUnPkgs.filter((s) => !!s).map(String) : []
        if (derivedPkg && !pkgsBase.includes(derivedPkg)) pkgsBase.push(derivedPkg)
        const unique = Array.from(new Set(pkgsBase))
        if (!unique.length) {
          logger.debug?.('pre-uninstall skipped: no packages gathered')
        }
        for (const pkg of unique) {
          try {
            logger.info?.(`pre-uninstall package before install: ${pkg}`)
            const r = spawnSync('adb', ['-s', String(udid), 'uninstall', String(pkg)], {
              stdio: 'pipe',
              encoding: 'utf-8',
            })
            const out = (r.stdout || '').trim()
            const err = (r.stderr || '').trim()
            logger.debug?.(`adb uninstall ${pkg} -> code=${r.status} out=${out} err=${err}`)
          } catch (e) {
            logger.warn?.(`pre-uninstall failed for ${pkg}: ${e}`)
          }
        }
      }
    } catch (e) {
      logger.warn?.(`pre-uninstall step skipped due to error: ${e}`)
    }

    try {
      const capSummary = {
        app: selectedCaps['appium:app'] ? 'set' : 'n/a',
        appPackage: selectedCaps['appium:appPackage'] || 'n/a',
        appActivity: selectedCaps['appium:appActivity'] || 'n/a',
        noReset: selectedCaps['appium:noReset'],
        fullReset: selectedCaps['appium:fullReset'],
      }
      logger.info(
        `initializing android driver (mode=${installMode}, reason=${reason}) host=${server?.hostname}:${server?.port} caps=${JSON.stringify(
          capSummary,
        )}`,
      )
    } catch {}

    const finalServer = {
      protocol: (server?.protocol || 'http').replace(/:$/, ''),
      hostname: server?.hostname || '127.0.0.1',
      port: server?.port || 4723,
      path: server?.path || '/',
    }
    const finalCaps = withAndroidTimeoutDefaults(selectedCaps)

    try {
      await waitForAppiumServer(finalServer, logger, 15000)
    } catch {}

    const finalOpts: any = {
      ...finalServer,
      logLevel: 'info',
      connectionRetryTimeout: 120000,
      connectionRetryCount: 2,
      capabilities: finalCaps,
    }

    let newDriver: any = null
    let lastErr: any = null
    for (let i = 0; i < 2 && !newDriver; i++) {
      try {
        newDriver = await remote(finalOpts)
      } catch (e) {
        lastErr = e
        logger.warn(`remote() attempt ${i + 1} failed: ${e}`)
        await sleep(2000)
      }
    }
    if (!newDriver) {
      throw new Error(
        `remote driver initialize failed ${JSON.stringify({
          mode: installMode,
          reason,
        })}: ${lastErr || 'unknown'}`,
      )
    }
    logger.info(`create android driver (reason=${reason})`)
    if (shareSession || keepAndroidOpen) {
      store.set(key, newDriver)
      logger.info(`driver stored with key: ${key}`)
    }
    return { driver: newDriver, installMode }
  }

  const assignDriver = (drv: any) => {
    driver = drv
    instance.setPage(drv)
  }

  const recreateDriver = async () => {
    logger.warn('Attempting to recreate android driver session...')
    try {
      await (driver as any)?.deleteSession?.()
    } catch {}
    if (shareSession || keepAndroidOpen) {
      store.delete(key)
    }
    const { driver: newDriver, installMode } = await createAndroidDriver('recreate')
    installModeForThisRun = installMode
    assignDriver(newDriver)
    return newDriver
  }

  let reused = false
  if (driver) {
    try {
      await (driver as any).getPageSource?.()
      logger.info(`reusing android driver session for key: ${key}`)
      reused = true
    } catch (e) {
      logger.warn(`stale android session detected for key: ${key}, recreating...`)
      driver = await recreateDriver()
    }
  }

  let created = false
  if (!driver) {
    const { driver: newDriver, installMode } = await createAndroidDriver('initial')
    installModeForThisRun = installMode
    driver = newDriver
    created = true
  }

  assignDriver(driver)
  ;(instance as any).__androidRecreateDriver = recreateDriver
  ;(instance as any).__androidEnsureAlive = async () => {
    if (!driver || typeof (driver as any).getPageSource !== 'function') return
    try {
      await (driver as any).getPageSource()
    } catch (err) {
      logger.warn(`android driver appears invalid before test execution: ${err}`)
      await recreateDriver()
    }
  }

  const bringToFront = (Ctor as any).__androidBringToFront
  const shouldBring = bringToFront !== false
  logger.info(
    `bringToFront decision: reused=${reused} created=${created} enabled=${String(
      shouldBring,
    )} runMode=${installModeForThisRun}`,
  )
  if (shouldBring) {
    try {
      const capsLaunchMeta = (Ctor as any).__androidCapsLaunch
      const pkg: string | undefined =
        capsLaunchMeta?.['appium:appPackage'] || androidOpts?.capabilities?.['appium:appPackage']
      const act: string | undefined =
        capsLaunchMeta?.['appium:appActivity'] || androidOpts?.capabilities?.['appium:appActivity']
      logger.info(`bringToFront target: package=${pkg || 'n/a'} activity=${act || 'n/a'}`)
      if (pkg) {
        if (typeof (driver as any).activateApp === 'function') {
          logger.info(`bringToFront via activateApp(${pkg})`)
          await (driver as any).activateApp(pkg)
        } else if (typeof (driver as any).startActivity === 'function' && act) {
          logger.info(`bringToFront via startActivity(${pkg}, ${act})`)
          await (driver as any).startActivity(pkg, act)
        }
      }
    } catch (e) {
      logger.warn(`bring-to-front failed: ${e}`)
    }
  } else {
    logger.info('bringToFront skipped: disabled by configuration')
  }

  instance.setPage(driver)
}

async function runSingleTestCaseCtor(params: {
  Ctor: TestCaseConstructor
  clientId: string
  workspace: string
  loggerService: any
  browserHelper: any
  options?: MainOptions
  mainLogger: any
}): Promise<{
  entry?: {
    className: string
    report?: any
    error?: string
    metadata?: Record<string, any>
  }
  aborted: boolean
  abortError?: string
}> {
  const { Ctor, clientId, workspace, loggerService, browserHelper, options, mainLogger } = params

  const shouldStop = options?.shouldStop

  const needBrowser = (Ctor as any).__useBrowser
  const isAndroid = (Ctor as any).__withAndroid
  const androidOpts = (Ctor as any).__androidOpts
  const headless = (Ctor as any).__headless
  const debug = (Ctor as any).__debug
  const keepAndroidOpen = options?.keepAppOpen ?? (Ctor as any).__keepAppOpen
  const shareSession = !!options?.shareSession
  const sessionKey = options?.sessionKey || clientId
  const domain = (Ctor as any).__domain
  const timeout = (Ctor as any).__timeout
  const retry = (Ctor as any).__retry
  const isBddGenerated = (Ctor as any).__isBddGenerated === true
  const classLogger = loggerService.createLogger(Ctor.name, clientId)
  const instance = new Ctor(classLogger, clientId, workspace)
  const classMetadata = asRecord((Ctor as any).__reportMetadata)
  if (Object.keys(classMetadata).length) {
    instance.setReportMetadata(classMetadata)
  }
  if ((Ctor as any).module) {
    instance.setReportMetadata({ module: (Ctor as any).module })
  }
  const runtimeMetadata: Record<string, any> = {}
  if (options?.userDir) runtimeMetadata.userDir = options.userDir
  runtimeMetadata.clientId = clientId
  runtimeMetadata.workspace = workspace
  runtimeMetadata.platform = isAndroid ? 'android' : needBrowser ? 'web' : 'generic'
  instance.setReportMetadata(runtimeMetadata)
  const allMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
  mainLogger.info(`browser:${needBrowser},isAndroid:${isAndroid}`)
  const withBrowserMethods: string[] = []
  const testMethods: string[] = []

  if (shouldStop?.()) {
    mainLogger.info(`Stop requested before executing ${Ctor.name}, skipping`)
    return {
      entry: undefined,
      aborted: true,
      abortError: 'Stop requested',
    }
  }

  for (const key of allMethods) {
    if (typeof (instance as any)[key] === 'function') {
      if (key.startsWith('browser')) {
        withBrowserMethods.push(key)
      }
      if (key.startsWith('test')) {
        testMethods.push(key)
      }
    }
  }
  mainLogger.debug(
    `module: ${instance.constructor.name} workspace: ${workspace} domain:${domain} starting...`,
  )

  // start browser for test with new browser
  const browserPromises: Promise<void>[] = []
  for (const method of withBrowserMethods) {
    if (shouldStop?.()) {
      mainLogger.info(
        `Stop requested before browser helper for ${Ctor.name}, skipping remaining browser* methods`,
      )
      break
    }
    let tempins: any = null
    try {
      tempins = instance.clone()
      const { bs, page } = await browserHelper.newBrowser({
        logger: mainLogger,
        headless,
        timeout,
        domain,
        retry,
      })
      tempins.setPage(page)
      tempins.setBrowser(bs)
      tempins.tearUp()
      const ret = await (tempins as any)[method](page)
      browserPromises.push(ret)
    } catch (err) {
      mainLogger.error(`${err}`)
    } finally {
      tempins?.tearDown()
    }
  }

  let rst: any = null
  try {
    // end for with browser methods
    if (needBrowser) {
      rst = await browserHelper.newBrowser({
        logger: mainLogger,
        headless,
        timeout,
        domain,
        retry,
      })
      rst?.page && instance.setPage(rst?.page)
      rst?.bs && instance.setBrowser(rst.bs)
    } else if (isAndroid) {
      await setupAndroidForTestCaseInstance({
        Ctor,
        instance,
        logger: mainLogger,
        androidOpts,
        shareSession,
        keepAndroidOpen,
        sessionKey,
        clientId,
      })
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    mainLogger.info(`Error to run test cases ${errorMessage}`)
    return {
      entry: {
        className: Ctor?.name ?? 'UnknownTestCase',
        report: instance?.getReportData?.(),
        error: errorMessage,
      },
      aborted: true,
      abortError: errorMessage,
    }
  }

  await instance.tearUp()
  for (const method of testMethods) {
    if (shouldStop?.()) {
      mainLogger.info(`Stop requested; skipping remaining tests for ${Ctor.name}`)
      break
    }
    const shouldAutoTrack = !isBddGenerated
    const caseName = `${Ctor.name}.${method}`
    if (shouldAutoTrack) {
      ;(instance as any).__beginCase?.(caseName, {
        suitePath: [Ctor.name],
        testTitle: method,
        index: method,
        type: 'class-method',
      })
    }
    let caseError: unknown = null
    try {
      try {
        await (instance as any).__androidEnsureAlive?.()
      } catch (ensureErr) {
        mainLogger.warn(
          `android driver ensure-alive failed before ${Ctor.name}.${method}: ${ensureErr}`,
        )
        throw ensureErr
      }
      mainLogger.info(
        `Running ${Ctor.name}.${method} ret:${!rst?.page ? 'no browser' : 'browser opened'}`,
      )
      await (instance as any)[method]()
      mainLogger.info(`${Ctor.name}.${method} passed`)
    } catch (err) {
      caseError = err
      // eslint-disable-next-line no-console
      console.error(`${String(err)}`)
      mainLogger.error(
        `${Ctor.name}.${method} Failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      if (shouldAutoTrack) {
        ;(instance as any).__finishCase?.(
          caseError ? 'failed' : 'passed',
          caseError ?? undefined,
        )
      }
      mainLogger.info(`${Ctor.name}.${method} completed`)
    }
  }

  await instance.tearDown()
  const reportData = instance.getReportData?.() ?? null
  const aggregatedMetadata = {
    ...(instance.getReportMetadata?.() ?? {}),
    isAndroid,
    needBrowser,
  }
  if (reportData && typeof reportData === 'object') {
    ;(reportData as any).metadata = {
      ...(reportData as any).metadata ?? {},
      ...aggregatedMetadata,
    }
  }

  if (!debug) {
    needBrowser && browserHelper.close()
  }
  if (isAndroid) {
    try {
      if (shareSession) {
        mainLogger.info('android driver kept alive (shareSession=true)')
      } else if (!keepAndroidOpen) {
        // 主动结束会话，避免残留；当 keepAppOpen=true 时不结束会话，从而保持 App 运行
        const drv: any = (instance as any).page
        await drv?.deleteSession?.()
        mainLogger.info('android driver session closed')
      } else {
        mainLogger.info('android driver kept alive (keepAppOpen=true)')
      }
    } catch (e) {
      mainLogger.error(`android driver cleanup error: ${e}`)
    }
  }

  const stoppedNow = shouldStop?.() ?? false

  return {
    entry: {
      className: Ctor.name,
      report: reportData,
      metadata: aggregatedMetadata,
    },
    aborted: stoppedNow,
    abortError: stoppedNow ? 'Stop requested' : undefined,
  }
}

export async function main({
  clientId,
  workspace,
  loggerService,
  browserHelper,
  options,
}: {
  clientId: string
  workspace: string
  loggerService: any
  browserHelper: any
  options?: MainOptions
}) {
  const logger = loggerService.createLogger('main', clientId)
  // 将运行期环境配置与 logger 注入到全局，供 useTestCase/resolveUseTestCaseOptions 使用
  try {
    ;(globalThis as any).__gttEnvConfig = options?.envConfig ?? null
    ;(globalThis as any).__gttLoggerService = loggerService
    ;(globalThis as any).__gttClientId = clientId
  } catch {
    // ignore
  }
  logger.info(`userdir:${options?.userDir}`)
  const executionResults: Array<{
    className: string
    report?: any
    error?: string
    metadata?: Record<string, any>
  }> = []

  prepareBddTestCaseClasses()

  for (const Ctor of __testCaseClasses as TestCaseConstructor[]) {
    const { entry, aborted, abortError } = await runSingleTestCaseCtor({
      Ctor,
      clientId,
      workspace,
      loggerService,
      browserHelper,
      options,
      mainLogger: logger,
    })

    if (entry) {
      executionResults.push(entry)
    }

    logger.info('All TestCase Completed!')
    logger.complete()
    __testCaseClasses.length = 0

    if (aborted) {
      return {
        results: executionResults,
        aborted: true,
        error: abortError,
      }
    }
  }
  if (__testCaseClasses.length) {
    __testCaseClasses.length = 0
  }
  return { results: executionResults }
}
