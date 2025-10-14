import { __testCaseClasses } from './test-case-decorator'
import { TestCase } from './test-case-base'
import { BrowserHelper, CustomLogger } from '../../types'

type TestCaseConstructor = new (logger: any) => TestCase
export async function main({
  clientId,
  workspace,
  loggerService,
  browserHelper,
}: {
  clientId: string
  workspace: string
  loggerService: any
  browserHelper: BrowserHelper
}) {
  const logger = loggerService.createLogger('main', clientId) as CustomLogger
  for (const Ctor of __testCaseClasses as TestCaseConstructor[]) {
    const needBrowser = (Ctor as any).__useBrowser
    const headless = (Ctor as any).__headless
    const debug = (Ctor as any).__debug
    const domain = (Ctor as any).__domain
    const timeout = (Ctor as any).__timeout
    const retry = (Ctor as any).__retry

    let instance = new Ctor(loggerService.createLogger(Ctor.name, clientId), clientId, workspace)
    const allMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance))

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
    if (needBrowser) {
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
      }
    } catch (err) {
      logger.info('Error to run test cases')
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
    //end for testMethods
    logger.info('All TestCase Completed!')
    logger.complete()
    __testCaseClasses.length = 0
  }
}
