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
    this.logger = this.loggerService.createLogger('TeseCases');
  }
  private transpile(code:string){
    const compiledCode = ts.transpile(code,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017});

    return compiledCode
  }

  async runcase(fullcode: string) {
    const sandbox = { result: null, console };
    const context = createContext(sandbox);
    const wrapperCode = `
      ${fullcode}
      result = main()
    `;
    // 5. 执行
    try {
      const script = new Script(wrapperCode);
      script.runInContext(context,{timeout:5000});
      await sandbox.result; // 等待 main(page) 执行完成
    } catch (e) {
      console.error('用户代码异常:', e);
    } finally {
      console.log('执行完成')
    }
  }
  async run(code: string) {
    const testCaseCode = readFileSync('./cases/test-case.ts', 'utf-8');
    const fullCode = testCaseCode + '\n' + code;
    const jsFullCode = this.transpile(fullCode);
    this.logger.debug(`run tscode:${fullCode}`)
    this.logger.debug(`run jsfullcode: ${jsFullCode}`);
    this.runcase(jsFullCode)
    return { code: jsFullCode };
  }
}
