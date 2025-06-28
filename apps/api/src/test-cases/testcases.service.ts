import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { AndroidService } from 'src/mobile/android/android.service';
import { readFileSync } from 'fs';
import ts from 'typescript';
import { CustomLogger } from 'src/logger/logger.custom';
import { Script, createContext } from 'vm';
import { BrowserControl } from 'src/browser/browser';
import { Page } from 'puppeteer';
import { setTimeout } from 'timers';
import { SandboxExecutor } from './sandbox-executor';
import { ReportService } from 'src/report/report.service';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const sandBoxExec = new SandboxExecutor(
      clientId,
      './workspace/Anonymouse',
      this.logger,
      this.reportService,
    );
    await sandBoxExec.execute(clientCode);
  }
  async runcase2(frontCode: string, useBrowser: boolean, clientId: string) {
    //await this.androidService.screenOn('0A171FDD40063C', 'holding display', '125698', "300 900 300 200")
    let page: Page | null = null;
    let bc: BrowserControl | null = null;
    if (useBrowser) {
      bc = new BrowserControl(this.logger);
      page = await bc.launch();
    }
    const testLogger = this.loggerService.createLogger('TestCase', clientId);
    //const testCaseCodeTs = readFileSync('./cases/test-case.ts', 'utf-8');
    const testCaseCodeJsFromdist = readFileSync(
      './dist/cases/test-case.js',
      'utf-8',
    );
    const testCaseJs = ts.transpileModule(testCaseCodeJsFromdist, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
    }).outputText;
    const testCaseSandbox = { module: { exports: {} }, exports, require };
    testCaseSandbox.exports = testCaseSandbox.module.exports; // make exports and module.exports point to same object
    createContext(testCaseSandbox);
    new Script(testCaseJs).runInContext(testCaseSandbox);
    const testCaseExports = testCaseSandbox.module.exports;
    this.logger.debug('file exports' + JSON.stringify(testCaseExports));
    let codeFromFrontend = frontCode.replace(
      /import\s+{([^}]+)}\s+from\s+['"]test-case['"]\s*;/g,
      'const {$1} = require("test-case");',
    );

    const codeJsTrans = ts.transpileModule(codeFromFrontend, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
    });
    const codeJs = codeJsTrans.outputText;
    const sandbox = {
      exports: {},
      module: { exports: {} },
      testLogger,
      clientId,
      service: this.androidService,
      result: null,
      console,
      require: (name: string) => {
        if (name === 'test-case') {
          console.log(testCaseExports);
          return testCaseExports;
        }
        throw new Error('Module not found: ' + name);
      },
      page,
      sleep,
    };
    const context = createContext(sandbox);

    new Script(codeJs).runInContext(context, { timeout: 3000 });
    // 5. 执行
    try {
      new Script(
        'const { main } = require("test-case"); result = main(clientId,testLogger,sleep,service,page)',
      ).runInContext(context, { timeout: 5000 });
      await sandbox.result; // 等待 main(page) 执行完成
    } catch (e) {
      this.logger.error(`Exception in case: ${e}`);
      this.logger.sendLogTo(clientId, `Exception in case: ${e}`);
      this.logger.sendExitTo(clientId);
    } finally {
      //await bc?.closeBrowser();
    }
  }
  async run(code: string) {
    this.runcase(code, false, 'aa');
    return { status: 'ok', message: '' };
  }
}
