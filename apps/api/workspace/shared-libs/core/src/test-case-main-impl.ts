import {
  __testCaseClasses,
  __useBrowserStaticMethods,
} from './test-case-decorator';
import { TestCase } from './test-case-base';
import { BrowserHelper, CustomLogger } from '../../types';

type TestCaseConstructor = new (logger: any) => TestCase;
export async function main({
  clientId,
  workspace,
  loggerService,
  browserHelper,
}: {
  clientId: string;
  workspace: string;
  loggerService: any;
  browserHelper?: BrowserHelper;
}) {
  const logger = loggerService.createLogger('main', clientId) as CustomLogger;
  for (const Ctor of __testCaseClasses as TestCaseConstructor[]) {
    const needBrowser = (Ctor as any).__useBrowser;
    const headless = (Ctor as any).__headless;
    const debug = (Ctor as any).__debug;

    let instance = new Ctor(loggerService.createLogger(Ctor.name, clientId));
    const allMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(instance),
    );

    const withBrowserMethods: string[] = [];
    const testMethods: string[] = [];

    for (const key of allMethods) {
      if (typeof (instance as any)[key] === 'function') {
        if (key.startsWith('browser')) {
          withBrowserMethods.push(key);
        }
        if (key.startsWith('test')) {
          testMethods.push(key);
        }
      }
    }
    logger.debug(`browserMethods ${withBrowserMethods.length}`);
    logger.debug(
      `module: ${instance.constructor.name} workspace: ${workspace} starting...`,
    );
    await instance.tearUp();

    // start browser for test with new browser
    if (needBrowser && browserHelper) {
      const browserPromises: Promise<void>[] = [];
      for (const method of withBrowserMethods) {
        try {
          const tempins = instance.clone();
          const { page } = await browserHelper.newBrowser({ headless });
          const ret = (tempins as any)[method](page).catch((err: Error) => {
            logger.error(`${err}`);
            return { success: false, error: `${err}` };
          });
          browserPromises.push(ret);
        } catch (err) {
          logger.error(`${err}`);
        }
      }
    }
    // end for with browser methods
    const rst = await browserHelper?.newBrowser({ headless });
    rst?.page && instance.setPage(rst?.page);
    for (const method of testMethods) {
      try {
        logger.info(
          `Running ${Ctor.name}.${method} ret:${!rst?.page ? 'no browser' : 'browser opened'}`,
        );
        await (instance as any)[method]();
        logger.info(`${Ctor.name}.${method} passed`);
      } catch (err) {
        console.error(`${String(err)}`);
        logger.error(
          `${Ctor.name}.${method} Failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        logger.info(`${Ctor.name}.${method} completed`);
      }
    }

    if (!debug) {
      await browserHelper?.close();
    }
    //end for testMethods
    logger.info('All TestCase Completed!');
    logger.complete();
  }
}
