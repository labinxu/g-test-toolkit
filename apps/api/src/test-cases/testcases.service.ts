import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { readFileSync } from 'fs';
import * as ts from "typescript";
import { CustomLogger } from 'src/logger/logger.custom';
import { Script, createContext } from 'vm';
@Injectable()
export class TestCasesService {
  private logger: CustomLogger;

  constructor(private readonly loggerService: LoggerService) {
      this.logger = this.loggerService.createLogger('AppService');
  }

  private transpile(code:string){
    const compiledCode = ts.transpile(code,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017});

    return compiledCode
  }

  async runcase(fullcode: string) {
    const testlogger = this.loggerService.createLogger('TestCase')
    const sandbox = { exports: {}, module: { exports: {} }, testlogger, result: null, console };
    const context = createContext(sandbox);
    const wrapperCode = `
      ${fullcode}
      result = main(testlogger)
    `;
    // 5. 执行
    try {
      const script = new Script(wrapperCode);
      script.runInContext(context,{timeout:5000});
      await sandbox.result; // 等待 main(page) 执行完成
    } catch (e) {
      this.logger.error(`Exception in case: ${e}`);
    } finally {
      this.logger.debug('Test Case finished!')
    }
  }
  async run(code: string) {
    const testCaseCode = readFileSync('./cases/test-case.ts', 'utf-8');
    const fullCode = testCaseCode + '\n' + code;
    const jsFullCode = this.transpile(fullCode);
    this.runcase(jsFullCode)
    return { code: jsFullCode };
  }
}
