import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { readFileSync } from 'fs';
import * as ts from 'typescript';
import { CustomLogger } from 'src/logger/logger.custom';
import { Script, createContext } from 'vm';
@Injectable()
export class TestCasesService {
  private logger: CustomLogger;

  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('AppService');
  }

  private transpile(code: string) {
    const compiledCode = ts.transpile(code, {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    });

    return compiledCode;
  }

  async runcase(fullcode: string) {
    const testLogger = this.loggerService.createLogger('TestCase');
    const testCaseCodeTs = readFileSync('./cases/test-case.ts', 'utf-8');

    const testCaseJs = ts.transpileModule(testCaseCodeTs, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
    }).outputText;
    const testCaseSandbox = { module: { exports: {} },exports };
    testCaseSandbox.exports = testCaseSandbox.module.exports; // 关键：让 exports 和 module.exports 指向同一个对象

    createContext(testCaseSandbox);
    new Script(testCaseJs).runInContext(testCaseSandbox);
    const testCaseExports = testCaseSandbox.module.exports;

    let codeFromFrontend = fullcode.replace(
      /import\s+{([^}]+)}\s+from\s+['"]test-case['"]\s*;/g,
      'const {$1} = require("test-case");'
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
      result: null,
      console,
      require: (name: string) => {
        if (name === 'test-case') return testCaseExports;
        throw new Error('Module not found: ' + name);
      },
    };
    const context = createContext(sandbox);
    new Script(codeJs).runInContext(context, { timeout: 3000 });

    // 5. 执行
    try {
      new Script('const { main } = require("test-case"); result = main(testLogger)').runInContext(context, { timeout: 5000 });
      await sandbox.result; // 等待 main(page) 执行完成
    } catch (e) {
      this.logger.error(`Exception in case: ${e}`);
    } finally {
      this.logger.debug('Test Case finished!');
    }
  }
  async run(code: string) {

    this.runcase(code);
    return { code: code };
  }
}
