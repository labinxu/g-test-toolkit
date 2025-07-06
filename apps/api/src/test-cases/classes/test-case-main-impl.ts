import {
  __testCaseClasses,
  __useBrowserStaticMethods,
} from './test-case-decorator';
import { TestCase } from './test-case-base';
import { AndroidService } from 'src/mobile/android/android.service';
import { Page } from 'puppeteer';
import { ReportService } from 'src/report/report.service';
import { LoggerService } from 'src/logger/logger.service';
import { BrowserControl } from 'src/browser/browser';
function initTestCaseInstance(
  instance: TestCase,
  workspace: string,
  page: Page,
  loggerService: LoggerService,
  androidService: AndroidService,
  clientId: string,
) {
  instance.setWorkspace(workspace);
  instance.setClientId(clientId);
  instance.setLoggerService(loggerService);
  if (androidService) instance.setAndroidService(androidService);
  if (page) instance.setPage(page);
  return instance;
}

export async function main(
  clientId: string,
  workspace: string,
  reportService: ReportService,
  loggerService: LoggerService,
  androidService?: AndroidService,
) {
  const logger = loggerService.createLogger('main');
  for (const Ctor of __testCaseClasses) {
    const needBrowser = (Ctor as any).__useBrowser;
    console.log('needBrowser', needBrowser);
    const headless = (Ctor as any).__headless;
    const debug = (Ctor as any).__debug;

    let page: Page | null = null;
    let bc: BrowserControl | null = null;
    let bcs: BrowserControl[] = [];
    const browserPromises: Promise<void>[] = [];

    if (needBrowser) {
      bc = new BrowserControl(logger);
      page = await bc.launch({ headless });
    }

    let instance = new (Ctor as { new (): TestCase })();
    try {
      instance = initTestCaseInstance(
        instance,
        workspace,
        page,
        loggerService,
        androidService,
        clientId,
      );
      logger.setContext(Ctor.name);

      await instance.tearUp();
      const withBrowserMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(instance),
      ).filter(
        (key) =>
          key.startsWith('browser') &&
          typeof (instance as any)[key] === 'function',
      );
      for (const method of withBrowserMethods) {
        try {
          const tempins = instance.clone();
          const brc = new BrowserControl(logger);
          page = await brc.launch({ headless });
          const ret = (tempins as any)[method](page).catch((err: Error) => {
            logger.sendErrorTo(clientId, `${err}`);
            return { success: false, error: `${err}` };
          });
          browserPromises.push(ret);
          bcs.push(brc);
        } catch (err) {
          logger.sendErrorTo(clientId, `${err}`);
        }
      }

      const testMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(instance),
      ).filter(
        (key) =>
          key.startsWith('test') &&
          typeof (instance as any)[key] === 'function',
      );
      for (const method of testMethods) {
        try {
          logger.sendInfoTo(clientId, `Running ${Ctor.name}.${method}`);
          await (instance as any)[method]();
          logger.sendInfoTo(clientId, `${Ctor.name}.${method} passed`);
        } catch (err) {
          console.error(`${String(err)}`);
          logger.sendErrorTo(
            clientId,
            `${Ctor.name}.${method} Failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        } finally {
          logger.info(`${Ctor.name}.${method} completed`);
        }
      }
    } catch (err) {
      logger.sendExitTo(clientId);
      logger.error(`${err instanceof Error}?${(err as Error).stack}:${err}`);
      logger.sendErrorTo(
        clientId,
        `Test ${Ctor.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await Promise.allSettled(browserPromises);
      if (!debug) {
        await bc?.closeBrowser();
        await Promise.allSettled(bcs.map((bc) => bc.closeBrowser()));
        await instance.tearDown();
      }
      logger.sendInfoTo(clientId, `TestCase ${Ctor.name} completed`);
    }
    reportService.generate(workspace, Ctor.name, instance.getReportData());
  }
  logger.sendInfoTo(clientId, 'All TestCase Completed!');
  logger.sendExitTo(clientId);
}
