import { __testCaseClasses } from './test-case-decorator';
import { TestCase } from './test-case-base';
import { CustomLogger } from 'src/logger/logger.custom';
import { AndroidService } from 'src/mobile/android/android.service';
import { Page } from 'puppeteer';
import { ReportService } from 'src/report/report.service';

export async function main(
  clientId: string,
  logger: CustomLogger,
  sleep: (ms: number) => Promise<void>,
  workspace: string,
  reportService: ReportService,
  service?: AndroidService,
  page?: Page,
) {
  for (const Ctor of __testCaseClasses) {
    const instance = new (Ctor as { new (): TestCase })();
    try {
      instance.setWorkspace(workspace);
      instance.setLogger(logger);
      instance.setClientId(clientId);
      if (page) instance.setPage(page);
      instance.setSleep(sleep);
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
    }
    reportService.generate(workspace, Ctor.name, instance.getReportData());
  }
  logger.sendExitTo(clientId);
}
