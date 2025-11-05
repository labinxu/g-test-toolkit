import { __testCaseClasses } from './test-case-decorator'
import { TestCase } from './test-case-base'
import { remote } from 'webdriverio'

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
    const _logger = loggerService.createLogger(Ctor.name, clientId)
    let instance = new Ctor(_logger, clientId, workspace)
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
        // Determine mode for this run (no external override; from decorator)
        const installModeForThisRun: 'install' | 'launch' =
          (Ctor as any).__androidInstallBehavior ?? 'install'
        logger.info(`android run mode decided: ${installModeForThisRun}`)

        let driver = shareSession ? store.get(key) : undefined
        let reused = false
        if (driver) {
          // Validate the existing session; recreate if invalid
          try {
            await (driver as any).getPageSource?.()
            logger.info(`reusing android driver session for key: ${key}`)
            reused = true
          } catch (e) {
            logger.warn(`stale android session detected for key: ${key}, recreating...`)
            try {
              await (driver as any).deleteSession?.()
            } catch {}
            store.delete(key)
            driver = undefined
          }
        }
        let created = false
        if (!driver) {
          // 选择运行模式：依据装饰器设定推断，默认 'install'（不允许外部覆盖）
          let installMode: 'install' | 'launch' =
            (Ctor as any).__androidInstallBehavior ?? 'install'

          // 从装饰器元数据中获取 server 与两种模式的 caps
          const server = (Ctor as any).__androidServer || {
            protocol: androidOpts?.protocol,
            hostname: androidOpts?.hostname,
            port: androidOpts?.port,
            path: androidOpts?.path,
          }
          const capsInstall = (Ctor as any).__androidCapsInstall || androidOpts?.capabilities
          const capsLaunch = (Ctor as any).__androidCapsLaunch

          // 若选择 launch 但缺少包名/Activity，则回退到 install
          if (installMode === 'launch' && !capsLaunch) {
            logger.warn('直启模式缺少 appPackage/appActivity，回退为安装模式')
            installMode = 'install'
          }

          // 选择最终 capabilities，并在缺失时给出明确错误
          const selectedCaps = installMode === 'launch' ? capsLaunch : capsInstall
          if (!selectedCaps) {
            if (installMode === 'launch') {
              throw new Error(
                'Launch 模式需要提供 appPackage 与 appActivity（@withAndroid），或改为 install 模式并提供 apk'
              )
            }
            throw new Error(
              'Install 模式需要提供 apk（@withAndroid），或改为 launch 模式并提供 appPackage/appActivity'
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
              `initializing android driver (mode=${installMode}) host=${server?.hostname}:${server?.port} caps=${JSON.stringify(
                capSummary
              )}`
            )
          } catch {}

          // Fill sensible defaults for server and capabilities to improve stability
          const finalServer = {
            protocol: (server?.protocol || 'http').replace(/:$/, ''),
            hostname: server?.hostname || '127.0.0.1',
            port: server?.port || 4723,
            path: server?.path || '/',
          }
          const finalCaps = withAndroidTimeoutDefaults(selectedCaps)

          // Ensure server is up before requesting /session (best-effort)
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

          // Retry remote initialization a couple of times to avoid transient failures
          {
            let ok = false
            let lastErr: any = null
            for (let i = 0; i < 2 && !ok; i++) {
              try {
                driver = await remote(finalOpts)
                ok = !!driver
              } catch (e) {
                lastErr = e
                logger.warn(`remote() attempt ${i + 1} failed: ${e}`)
                await sleep(2000)
              }
            }
            if (!ok || !driver) {
              throw new Error(
                `remote driver initialize failed ${JSON.stringify({ mode: installMode })}: ${lastErr || 'unknown'}`
              )
            }
          }
          if (!driver) {
            throw new Error(
              `remote driver initialize failed ${JSON.stringify({ mode: installMode })}`
            )
          }
          logger.info('create android driver')
          created = true
          if (shareSession || keepAndroidOpen) {
            store.set(key, driver)
            logger.info(`driver stored with key: ${key}`)
          }
        }
        // Try to bring the AUT to foreground when reusing/creating sessions (configurable)
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
      logger.info(`Error to run test cases ${err}`)
      logger.complete()
      __testCaseClasses.length = 0
      return
    }
    await instance.tearUp()
    for (const method of testMethods) {
      try {
        logger.info(
          `Running ${Ctor.name}.${method} ret:${!rst?.page ? 'no browser' : 'browser opened'}`
        )
        await (instance as any)[method]()
        logger.info(`${Ctor.name}.${method} passed`)
      } catch (err) {
        console.error(`${String(err)}`)
        logger.error(
          `${Ctor.name}.${method} Failed: ${err instanceof Error ? err.message : String(err)}`
        )
      } finally {
        logger.info(`${Ctor.name}.${method} completed`)
      }
    }
    await instance.tearDown()
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
}
