import { __testCaseClasses } from './test-case-decorator';
import { TestCase } from './test-case-base';
import { AndroidService } from 'src/mobile/android/android.service';
import { Page } from 'puppeteer';
import { ReportService } from 'src/report/report.service';
import { LoggerService } from 'src/logger/logger.service';
import { BrowserControl } from 'src/browser/browser';

export async function main(
  clientId: string,
  workspace: string,
  reportService: ReportService,
  loggerService: LoggerService,
  service?: AndroidService,
) {
  const logger = loggerService.createLogger('main');
  for (const Ctor of __testCaseClasses) {
    const needBrowser = (Ctor as any).__useBrowser;
    const headless = (Ctor as any).__headless;
    let page: Page | null = null;
    let bc: BrowserControl | null = null;
    if (needBrowser) {
      bc = new BrowserControl(logger);
      page = await bc.launch({ headless });
    }

    const instance = new (Ctor as { new (): TestCase })();
    try {
      instance.setWorkspace(workspace);
      instance.setLoggerService(loggerService);
      instance.setClientId(clientId);
      if (page) instance.setPage(page);
      if (service) instance.setAndroidService(service);
      logger.setContext(Ctor.name);

      await instance.tearUp();
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
          logger.sendErrorTo(
            clientId,
            `${Ctor.name}.${method} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
        logger.info(`Test case ${method} completed successfully`);
      }
      await instance.tearDown();
      logger.info(`Test ${Ctor.name} completed successfully`);
    } catch (err) {
      logger.sendExitTo(clientId);
      logger.error(
        `Test ${Ctor.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      //bc?.closeBrowser();
    }
    reportService.generate(workspace, Ctor.name, instance.getReportData());
  }
  logger.sendExitTo(clientId);
}
