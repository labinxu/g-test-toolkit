import * as vm from 'vm';
import * as ts from 'typescript';
import {
  main,
  TestCase,
  Test,
  withBrowser,
  __testCaseClasses,
} from './classes/test-case-main';
import { CustomLogger } from 'src/logger/logger.custom';
import { AndroidService } from 'src/mobile/android/android.service';
import { ReportService } from 'src/report/report.service';
import { LoggerService } from 'src/logger/logger.service';
import { useBrowser } from './classes/test-case-decorator';

export class SandboxExecutor {
  private logger: CustomLogger;
  private reportService: ReportService;
  private androidService?: AndroidService;
  private loggerService: LoggerService;
  private workspace: string;
  private clientId: string;

  constructor(
    clientId: string,
    workspace: string,
    reportService: ReportService,
    loggerService: LoggerService,
    androidService?: AndroidService,
  ) {
    this.clientId = clientId;
    this.workspace = workspace;
    this.logger = loggerService.createLogger('SandboxExecutor');
    this.reportService = reportService;
    this.androidService = androidService;
    this.loggerService = loggerService;
  }

  private transpileTypeScript(code: string): string {
    try {
      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      });
      return result.outputText;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`TypeScript transpilation failed: ${errorMsg}`);
    }
  }

  async executeWithBundle(clientCode: string): Promise<void> {
    // Clear previous test case classes to avoid conflicts
    __testCaseClasses.length = 0;
    // Transpile TypeScript to JavaScript
    this.logger.debug('executeWithBundle');
    // Create a mock module and exports object for CommonJS compatibility
    const module = { exports: {} };
    const sandbox = {
      module,
      exports: module.exports,
      TestCase,
      Test,
      withBrowser,
      console: {
        log: (msg: string) => this.logger.info(msg),
        error: (msg: string) => this.logger.error(msg),
      },
      require: (moduleName: string) => {
        if (moduleName === 'test-case') {
          return { TestCase, Test, withBrowser, useBrowser };
        }
        throw new Error(`Module ${moduleName} is not available in sandbox`);
      },
    };

    // Create a VM context
    const context = vm.createContext(sandbox);
    this.logger.debug('executeWithBundle Create a VM context');
    try {
      // Wrap the transpiled code to ensure CommonJS exports work
      const wrappedCode = `
        (function(module, exports, require) {
          ${clientCode}
        })(module, exports, require);
      `;
      const script = new vm.Script(wrappedCode);
      await script.runInContext(context);
      // Run the registered test cases using the existing main function
      await main(
        this.clientId,
        this.workspace,
        this.reportService,
        this.loggerService,
        this.androidService,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.sendErrorTo(
        this.clientId,
        `Sandbox execution failed: ${errorMsg}`,
      );
      throw err;
    }
  }

  async execute(clientCode: string): Promise<void> {
    // Clear previous test case classes to avoid conflicts
    __testCaseClasses.length = 0;
    // Transpile TypeScript to JavaScript
    let jsCode: string;
    try {
      jsCode = this.transpileTypeScript(clientCode);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.sendErrorTo(this.clientId, errorMsg);
      throw err;
    }

    // Create a mock module and exports object for CommonJS compatibility
    const module = { exports: {} };
    const sandbox = {
      module,
      exports: module.exports,
      TestCase,
      Test,
      withBrowser,
      console: {
        log: (msg: string) => this.logger.info(msg),
        error: (msg: string) => this.logger.error(msg),
      },
      require: (moduleName: string) => {
        if (moduleName === 'test-case') {
          return { TestCase, Test, withBrowser, useBrowser };
        }
        throw new Error(`Module ${moduleName} is not available in sandbox`);
      },
    };

    // Create a VM context
    const context = vm.createContext(sandbox);

    try {
      // Wrap the transpiled code to ensure CommonJS exports work
      const wrappedCode = `
        (function(module, exports, require) {
          ${jsCode}
        })(module, exports, require);
      `;
      const script = new vm.Script(wrappedCode);
      await script.runInContext(context);
      // Run the registered test cases using the existing main function
      await main(
        this.clientId,
        this.workspace,
        this.reportService,
        this.loggerService,
        this.androidService,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.sendErrorTo(
        this.clientId,
        `Sandbox execution failed: ${errorMsg}`,
      );
      throw err;
    }
  }
}
