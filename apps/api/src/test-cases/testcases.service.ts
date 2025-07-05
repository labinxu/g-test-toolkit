import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { AndroidService } from 'src/mobile/android/android.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { SandboxExecutor } from './sandbox-executor';
import { ReportService } from 'src/report/report.service';
import * as path from 'path';
import { readFileSync, readdirSync } from 'fs';
import { Project, SyntaxKind } from 'ts-morph';
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
  async runcase(clientCode: string, clientId: string) {
    this.logger.info(`run case clientId:${clientId}`);

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
      this.logger.sendErrorTo(
        clientId,
        `Exception in case: ${err instanceof Error}?${(err as Error).stack}`,
      );
      this.logger.sendExitTo(clientId);
    }
  }
  async runcaseForBoundle(clientCode: string, clientId: string) {
    this.logger.info(`run runcaseForBoundle clientId:${clientId}`);

    const sandBoxExec = new SandboxExecutor(
      clientId,
      './workspace/Anonymouse',
      this.reportService,
      this.loggerService,
      this.androidService,
    );
    try {
      await sandBoxExec.executeWithBundle(clientCode);
    } catch (err) {
      this.logger.sendErrorTo(clientId, `Exception in case: ${err}`);
      this.logger.sendLogTo(clientId, `Exception in case: ${err}`);
      this.logger.sendExitTo(clientId);
    }
  }
  async executeDir(dir: string, clientId: string) {
    const files = readdirSync(dir).filter((f) => /\.(ts|js)$/.test(f));
    console.log(JSON.stringify(files));
    for (const f of files) {
      await this.executeFile(path.resolve(dir, f), clientId);
    }
  }
  async executeFile(path: string, clientId: string) {
    try {
      const code = readFileSync(path);
      await this.runcase(code.toString(), clientId);
    } catch (err) {
      this.logger.sendErrorTo(clientId, `${err}`);
    }
  }
  generateJsImplFromDts(dtsContent: string): string {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test-case.d.ts', dtsContent);

    let result = '';

    sourceFile.forEachChild((node) => {
      // 导出类
      if (node.getKind() === SyntaxKind.ClassDeclaration) {
        const classDecl = node.asKindOrThrow(SyntaxKind.ClassDeclaration);
        const name = classDecl.getName();
        result += `export class ${name} {}\n`;
      }
      // 导出函数
      if (node.getKind() === SyntaxKind.FunctionDeclaration) {
        const funcDecl = node.asKindOrThrow(SyntaxKind.FunctionDeclaration);
        const name = funcDecl.getName();
        console.log('export function', name);
        if (name === 'Test') {
          result += `
(globalThis as any).__testCaseClasses = (globalThis as any).__testCaseClasses || [];
export function Test(target) {
  (globalThis as any).__testCaseClasses.push(target);
}
`;
        } else {
          result += `export function ${name}() {}\n`;
        }
      }
      // 导出常量
      if (node.getKind() === SyntaxKind.VariableStatement) {
        const varDecls = node
          .asKindOrThrow(SyntaxKind.VariableStatement)
          .getDeclarations();
        for (const v of varDecls) {
          const name = v.getName();
          result += `export const ${name} = undefined;\n`;
        }
      }
      // 导出接口（可选，通常不用实现）
      if (node.getKind() === SyntaxKind.InterfaceDeclaration) {
        const ifaceDecl = node.asKindOrThrow(SyntaxKind.InterfaceDeclaration);
        const name = ifaceDecl.getName();
        result += `export class ${name} {}\n`; // 用class占位
      }
      // 导出类型别名（可选，不需要实现）
      if (node.getKind() === SyntaxKind.TypeAliasDeclaration) {
        const typeDecl = node.asKindOrThrow(SyntaxKind.TypeAliasDeclaration);
        const name = typeDecl.getName();
        result += `// type ${name} is skipped\n`;
      }
    });

    return result;
  }
  async run(code: string) {
    this.runcase(code, 'aa');
    return { status: 'ok', message: '' };
  }
}
