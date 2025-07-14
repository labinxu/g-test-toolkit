import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import * as path from 'path';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { Project } from 'ts-morph';
import { SyntaxKind } from 'typescript';
import * as fs from 'fs/promises';

// 匹配函数声明（不包含 constructor）
const methodRegex =
  /^\s*(?:public\s+|protected\s+|private\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*([^\{;]+)[\{;]?/gm;
@Injectable()
export class FilesService {
  private logger: CustomLogger;
  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('FileService');
  }
  makeTypesFile(oFile: string = null) {
    this.logger.debug(`'make types file' output:${oFile}`);
    // if (oFile && existsSync(oFile)) {
    //   const content = readFileSync(oFile);
    //   return content.toString().split('\n');
    // }
    const files = [
      'dist/test-cases/classes/impls/android-device.d.ts',
      'dist/test-cases/classes/impls/web-page.d.ts',
      'dist/test-cases/classes/test-case-base.d.ts',
    ];
    const project = new Project();
    const sourceFiles = files.map((path) => project.addSourceFileAtPath(path));
    const methodDeclarations: string[] = [
      'export declare function Test(): ClassDecorator;',
      'export declare function withBrowser(): ClassDecorator;',
      'export declare function WithHeadless(): ClassDecorator;',
      'export declare function useBrowser(): ClassDecorator;',
      'export declare class TestCase implements ITestBase {',
    ];

    for (const sourceFile of sourceFiles) {
      const classes = sourceFile.getClasses();
      for (const cls of classes) {
        const className = cls.getName() || 'UnnamedClass';
        // 提取类的成员函数声明
        const methods = cls
          .getMethods()
          .filter((method) => method.getKind() != SyntaxKind.Constructor)
          .map((method) => {
            return `${method.getText()};`;
          });
        // 添加类名作为注释
        if (methods.length > 0) {
          methodDeclarations.push(
            `// Methods from ${className}`,
            ...methods,
            '',
          );
        }
      }
    }
    const outputContent = `// Extracted method declarations from multiple .d.ts files\n${methodDeclarations.join('\n')}\n}`;
    // 创建新的 .d.ts 文件并写入提取的函数声明
    // const outputFile = project.createSourceFile(
    //   './node_modules/@types/test-case.d.ts',
    //   outputContent,
    //   { overwrite: false },
    // );

    // // 保存文件
    // outputFile.saveSync();
    return outputContent;
  }
  extractMethodsFromFile(filePath: string): string[] {
    const content = readFileSync(filePath, 'utf8');
    const result: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      if (methodName === 'constructor') continue; // 排除构造函数
      const params = match[2];
      const retType = match[3].trim();
      result.push(`${methodName}(${params}): ${retType};`);
    }
    return result;
  }

  generateEntryFile(testDir: string) {
    const entryFile = path.join(testDir, 'index.ts');
    const files = readdirSync(testDir)
      .filter((f) => /\.(ts|js)$/.test(f))
      .map((f) => `import './${f}';`)
      .join('\n');
    writeFileSync(entryFile, files);
    return { entryFile };
  }
  async getTree(currentPath: string, depthLeft: number) {
    if (depthLeft < 0) return [];
    const files = await fs.readdir(currentPath, { withFileTypes: true });
    const result = [];
    for (const file of files) {
      const fullPath = path.join(currentPath, file.name);
      if (file.isDirectory()) {
        result.push({
          name: file.name,
          path: path.relative(process.cwd(), fullPath),
          isDirectory: true,
          children: await this.getTree(fullPath, depthLeft - 1),
        });
      } else {
        result.push({
          name: file.name,
          path: path.relative(process.cwd(), fullPath),
          isDirectory: false,
        });
      }
    }
    return result;
  }
}
