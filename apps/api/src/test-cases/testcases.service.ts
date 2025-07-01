import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { AndroidService } from 'src/mobile/android/android.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { SandboxExecutor } from './sandbox-executor';
import { ReportService } from 'src/report/report.service';

@Injectable()
export class TestCasesService {
  private logger: CustomLogger;
  constructor(
    private readonly loggerService: LoggerService,
    private readonly androidService: AndroidService,
    private readonly reportService: ReportService,
  ) {
    this.logger = this.loggerService.createLogger('TestCaseService');
  }
  async runcase(clientCode: string, useBrowser: boolean, clientId: string) {
    this.logger.info(`run case useBrowser: ${useBrowser} clientId:${clientId}`);

    const sandBoxExec = new SandboxExecutor(
      clientId,
      './workspace/Anonymouse',
      this.reportService,
      this.loggerService,
      this.androidService,
    );
    try {
      await sandBoxExec.execute(clientCode);
    } catch (err) {
      this.logger.error(`Exception in case: ${err}`);
      this.logger.sendLogTo(clientId, `Exception in case: ${err}`);
      this.logger.sendExitTo(clientId);
    }
  }
  async run(code: string) {
    this.runcase(code, false, 'aa');
    return { status: 'ok', message: '' };
  }
}
