import { __testCaseClasses, withAndroid, withBrowser } from './test-case-decorator'
import { TestCase } from './test-case-base'
import { remote } from 'webdriverio'
import {
  getBddRootSuites,
  clearBddSuites,
  filterOnlyTests,
  type BddSuite,
  type BddTest,
  type BddTestCaseDescriptor,
  type UseTestCaseOptions,
} from './test-case-bdd'

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
  totalTimeoutMs = 15000
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

type AggregatedHooks = {
  beforeAll: BddTest['fn'][]
  afterAll: BddTest['fn'][]
  beforeEach: BddTest['fn'][]
  afterEach: BddTest['fn'][]
}

type LeafSuite = {
  titles: string[]
  tests: BddTest[]
  hooks: AggregatedHooks
  descriptors: BddTestCaseDescriptor[]
  skipped: boolean
}

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? (value as Record<string, any>) : {}

const slugify = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || fallback
}

const extractMetadataFromOptions = (opts?: UseTestCaseOptions): Record<string, any> => {
  const meta: Record<string, any> = {}
  if (!opts) return meta
  if (opts.module) meta.module = opts.module
  if (opts.userDir) meta.userDir = opts.userDir
  if (Array.isArray(opts.tags) && opts.tags.length) meta.tags = opts.tags.slice()
  return meta
}

function collectLeafSuites(): LeafSuite[] {
  const roots = getBddRootSuites()
  if (!roots.length) return []
  filterOnlyTests()
  const leaves: LeafSuite[] = []
  const traverse = (suite: BddSuite, ancestors: BddSuite[]) => {
    const path = [...ancestors, suite]
    const skipped = path.some((s) => s.skipped)
    const activeTests = suite.tests.filter((test) => !test.skip)
    if (activeTests.length) {
      const hooks: AggregatedHooks = {
        beforeAll: [],
        afterAll: [],
        beforeEach: [],
        afterEach: [],
      }
      for (const s of path) {
        hooks.beforeAll.push(...s.hooks.beforeAll.map((h) => h.fn))
        hooks.beforeEach.push(...s.hooks.beforeEach.map((h) => h.fn))
      }
      for (const s of [...path].reverse()) {
        hooks.afterAll.push(...s.hooks.afterAll.map((h) => h.fn))
        hooks.afterEach.push(...s.hooks.afterEach.map((h) => h.fn))
      }
      const descriptorSource = [...path].reverse().find((s) => s.testCaseDescriptors.length > 0)
      const descriptors = descriptorSource ? descriptorSource.testCaseDescriptors.slice() : []
      leaves.push({
        titles: path.map((s) => s.title),
        tests: activeTests.slice(),
        hooks,
        descriptors,
        skipped,
      })
    }
    for (const child of suite.suites) {
      traverse(child, path)
    }
  }
  roots.forEach((suite) => traverse(suite, []))
  return leaves
}

function applyTestCaseOptions(ctor: any, options?: UseTestCaseOptions) {
  if (!options) {
    ctor.module = ctor.module ?? 'default'
    return
  }
  ctor.module = options.module ?? ctor.module ?? 'default'
  if (options.browser !== undefined && options.browser !== false) {
    withBrowser(options.browser)(ctor)
  }
  if (options.android !== undefined && options.android !== false) {
    const { installBehavior, bringToFront, ...androidOpts } = options.android
    withAndroid(androidOpts)(ctor)
    if (installBehavior) {
      ctor.__androidInstallBehavior = installBehavior
    }
    if (bringToFront !== undefined) {
      ctor.__androidBringToFront = !!bringToFront
    }
  }
  if (options.keepAppOpen !== undefined) {
    ctor.__keepAppOpen = !!options.keepAppOpen
  }
}

function createBddTestCaseClasses(): Array<
  new (logger: any, clientId: string, workspace: string) => TestCase
> {
  const leaves = collectLeafSuites()
  const classes: Array<new (logger: any, clientId: string, workspace: string) => TestCase> = []
  if (!leaves.length) return classes
  let counter = 0
  for (const leaf of leaves) {
    if (leaf.skipped || leaf.tests.length === 0) continue
    const className = `Bdd_${leaf.titles.map((t) => slugify(t, 'suite')).join('_')}_${counter++}`
    const totalTests = leaf.tests.length
    // Create dynamic subclass of TestCase
    const Dynamic = class extends TestCase {
      private __bddState: {
        beforeAllRun: boolean
        beforeAllError?: unknown
        afterAllRun: boolean
        completed: number
        total: number
      }
      constructor(logger: any, clientId: string, workspace: string) {
        super(logger, clientId, workspace)
        this.__bddState = {
          beforeAllRun: false,
          afterAllRun: false,
          completed: 0,
          total: totalTests,
        }
      }
    }
    Object.defineProperty(Dynamic, 'name', { value: className })
    ;(Dynamic as any).__isBddGenerated = true

    // Apply TestCase options (use closest descriptor options)
    const primaryOptions = leaf.descriptors[0]?.options
    applyTestCaseOptions(Dynamic, primaryOptions)
    const baseMetadata = extractMetadataFromOptions(primaryOptions)
    ;(Dynamic as any).__reportMetadata = baseMetadata

    const descriptors = leaf.descriptors
    const hooks = leaf.hooks

    const setHolders = (instance: any) => {
      for (const descriptor of descriptors) {
        descriptor.holder.current = instance
      }
    }
    const clearHolders = () => {
      for (const descriptor of descriptors) {
        descriptor.holder.current = null
      }
    }
    const runHooks = async (instance: any, fns: Array<BddTest['fn']>) => {
      for (const fn of fns) {
        await fn.call(instance)
      }
    }
    const runHooksSafe = async (instance: any, fns: Array<BddTest['fn']>) => {
      try {
        await runHooks(instance, fns)
        return null
      } catch (err) {
        return err
      }
    }

    leaf.tests.forEach((test, idx) => {
      const methodName = `test_${idx + 1}_${slugify(test.title, 'test')}`
      Object.defineProperty(Dynamic.prototype, methodName, {
        value: async function () {
          const state = (this as any).__bddState as {
            beforeAllRun: boolean
            beforeAllError?: unknown
            afterAllRun: boolean
            completed: number
            total: number
          }
          const suitePath = leaf.titles
          const caseName = [...suitePath, test.title].join(' › ')
          ;(this as any).__beginCase?.(caseName, {
            suitePath,
            testTitle: test.title,
            index: idx,
            ...baseMetadata,
          })
          try {
            await (this as any).__androidEnsureAlive?.()
          } catch (ensureErr) {
            const instLogger = (this as any)?.logger
            instLogger?.warn?.(`android driver ensure-alive failed: ${ensureErr}`)
            throw ensureErr
          }
          setHolders(this)
          let primaryError: unknown = null
          let thrown = false
          let afterEachError: unknown = null
          let afterAllError: unknown = null
          try {
            if (!state.beforeAllRun) {
              const beforeAllError = await runHooksSafe(this, hooks.beforeAll)
              state.beforeAllRun = true
              if (beforeAllError) {
                state.beforeAllError = beforeAllError
                throw beforeAllError
              }
            }
            if (state.beforeAllError) {
              throw state.beforeAllError
            }
            const beforeEachErr = await runHooksSafe(this, hooks.beforeEach)
            if (beforeEachErr) {
              throw beforeEachErr
            }
            await test.fn.call(this)
          } catch (err) {
            primaryError = err
            thrown = true
            throw err
          } finally {
            const afterEachErr = await runHooksSafe(this, hooks.afterEach)
            if (afterEachErr) {
              afterEachError = afterEachErr
            }
            state.completed += 1
            const isLast = state.completed >= state.total
            if (isLast) {
              if (!state.afterAllRun) {
                state.afterAllRun = true
                const afterAllErr = await runHooksSafe(this, hooks.afterAll)
                if (afterAllErr) {
                  afterAllError = afterAllErr
                }
              }
              clearHolders()
            }

            const logger = (this as any)?.logger
            const logHookError = (label: string, err: unknown) =>
              logger?.error?.(
                `${label} hook failed: ${err instanceof Error ? err.message : String(err)}`
              )

            if (afterEachError) {
              logHookError('afterEach', afterEachError)
            }
            if (afterAllError) {
              logHookError('afterAll', afterAllError)
            }

            const finalError = primaryError ?? afterEachError ?? afterAllError ?? undefined
            ;(this as any).__finishCase?.(finalError ? 'failed' : 'passed', finalError)

            if (!thrown && finalError) {
              throw finalError
            }
          }
        },
      })
    })

    classes.push(Dynamic)
  }
  return classes
}

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
}

// TestCase requires (logger, clientId, workspace) per TestCase constructor
type TestCaseConstructor = new (logger: any, clientId: string, workspace: string) => TestCase
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
  logger.info(`userdir:${options?.userDir}`)
  const executionResults: Array<{
    className: string
    report?: any
    error?: string
    metadata?: Record<string, any>
  }> = []

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

  for (const Ctor of __testCaseClasses as TestCaseConstructor[]) {
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
    const _logger = loggerService.createLogger(Ctor.name, clientId)
    let instance = new Ctor(_logger, clientId, workspace)
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
    logger.info(`browser:${needBrowser},isAndroid:${isAndroid}`)
    const withBrowserMethods: string[] = []
    const testMethods: string[] = []

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
    logger.debug(
      `module: ${instance.constructor.name} workspace: ${workspace} domain:${domain} starting...`
    )

    // start browser for test with new browser
    const browserPromises: Promise<void>[] = []
    for (const method of withBrowserMethods) {
      let tempins = null
      try {
        tempins = instance.clone()
        const { bs, page } = await browserHelper.newBrowser({
          logger,
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
        logger.error(`${err}`)
      } finally {
        tempins?.tearDown()
      }
    }
    let rst = null
    try {
      // end for with browser methods
      if (needBrowser) {
        rst = await browserHelper.newBrowser({
          logger,
          headless,
          timeout,
          domain,
          retry,
        })
        rst?.page && instance.setPage(rst?.page)
        rst?.bs && instance.setBrowser(rst.bs)
      } else if (isAndroid) {
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
          let installMode: 'install' | 'launch' =
            (Ctor as any).__androidInstallBehavior ?? 'install'

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
              `remote driver initialize failed ${JSON.stringify({ mode: installMode, reason })}: ${lastErr || 'unknown'}`,
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
            shouldBring
          )} runMode=${installModeForThisRun}`
        )
        if (shouldBring) {
          try {
            const capsLaunchMeta = (Ctor as any).__androidCapsLaunch
            const pkg: string | undefined =
              capsLaunchMeta?.['appium:appPackage'] ||
              androidOpts?.capabilities?.['appium:appPackage']
            const act: string | undefined =
              capsLaunchMeta?.['appium:appActivity'] ||
              androidOpts?.capabilities?.['appium:appActivity']
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.info(`Error to run test cases ${errorMessage}`)
      executionResults.push({
        className: Ctor?.name ?? 'UnknownTestCase',
        report: instance?.getReportData?.(),
        error: errorMessage,
      })
      logger.complete()
      __testCaseClasses.length = 0
      return {
        results: executionResults,
        aborted: true,
        error: errorMessage,
      }
    }
    await instance.tearUp()
    for (const method of testMethods) {
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
          logger.warn(`android driver ensure-alive failed before ${Ctor.name}.${method}: ${ensureErr}`)
          throw ensureErr
        }
        logger.info(
          `Running ${Ctor.name}.${method} ret:${!rst?.page ? 'no browser' : 'browser opened'}`
        )
        await (instance as any)[method]()
        logger.info(`${Ctor.name}.${method} passed`)
      } catch (err) {
        caseError = err
        console.error(`${String(err)}`)
        logger.error(
          `${Ctor.name}.${method} Failed: ${err instanceof Error ? err.message : String(err)}`
        )
      } finally {
        if (shouldAutoTrack) {
          ;(instance as any).__finishCase?.(
            caseError ? 'failed' : 'passed',
            caseError ?? undefined,
          )
        }
        logger.info(`${Ctor.name}.${method} completed`)
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
      reportData.metadata = {
        ...(reportData.metadata ?? {}),
        ...aggregatedMetadata,
      }
    }
    executionResults.push({
      className: Ctor.name,
      report: reportData,
      metadata: aggregatedMetadata,
    })
    if (!debug) {
      needBrowser && browserHelper.close()
    }
    if (isAndroid) {
      try {
        if (shareSession) {
          logger.info('android driver kept alive (shareSession=true)')
        } else if (!keepAndroidOpen) {
          // 主动结束会话，避免残留；当 keepAppOpen=true 时不结束会话，从而保持 App 运行
          const drv: any = (instance as any).page
          await drv?.deleteSession?.()
          logger.info('android driver session closed')
        } else {
          logger.info('android driver kept alive (keepAppOpen=true)')
        }
      } catch (e) {
        logger.error(`android driver cleanup error: ${e}`)
      }
    }
    //end for testMethods
    logger.info('All TestCase Completed!')
    logger.complete()
    __testCaseClasses.length = 0
  }
  if (__testCaseClasses.length) {
    __testCaseClasses.length = 0
  }
  return { results: executionResults }
}
