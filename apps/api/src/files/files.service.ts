import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import * as esbuild from 'esbuild';
import * as path from 'path';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';

// 匹配函数声明（不包含 constructor）
const methodRegex =
  /^\s*(?:public\s+|protected\s+|private\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*([^\{;]+)[\{;]?/gm;
@Injectable()
export class FilesService {
  private logger: CustomLogger;
  constructor(private readonly loggerService: LoggerService) {
    this.logger = loggerService.createLogger('FileService');
  }
  makeTypesFile(oFile: string = null): string[] {
    this.logger.debug('make types file');
    if (existsSync(oFile)) {
      const content = readFileSync(oFile);
      return content.toString().split('\n');
    }
    const files = [
      'dist/src/test-cases/classes/impls/android-device.d.ts',
      'dist/src/test-cases/classes/impls/web-page.d.ts',
      'dist/src/test-cases/classes/test-case-base.d.ts',
    ];

    const output: string[] = [
      'export declare function Test(): ClassDecorator;',
      'export declare function WithBrowser(): ClassDecorator;',
      'export declare function WithHeadless(): ClassDecorator;',
      'export declare class TestCase implements ITestBase {',
    ];
    for (const file of files) {
      output.push(...this.extractMethodsFromFile(file));
    }
    output.push('}');
    if (oFile) {
      writeFileSync(oFile, output.join('\n'), 'utf8');
    }
    return output;
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
}
