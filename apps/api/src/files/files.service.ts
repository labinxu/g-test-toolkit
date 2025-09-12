import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs';
import * as fs from 'fs/promises';
import {
  Project,
  SyntaxKind,
  FunctionDeclaration,
  ModuleKind,
  ScriptTarget,
  ModuleResolutionKind,
} from 'ts-morph';
import { checkPath, combineDtsFiles, findDtsFiles } from 'src/common/utils';

// 匹配函数声明（不包含 constructor）
const methodRegex =
  /^\s*(?:public\s+|protected\s+|private\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*([^\{;]+)[\{;]?/gm;

async function getTypeScriptFiles(tdir: string): Promise<string[]> {
  let results: string[] = [];
  const dir = checkPath(tdir);
  const files = await fs.readdir(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      const subFiles = await getTypeScriptFiles(fullPath);
      results = results.concat(subFiles);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }

  return results;
}
@Injectable()
export class FilesService {
  private logger: CustomLogger;
  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('FileService');
  }
  async makeHelperTypes() {
    const modulePath = path.resolve(
      __dirname,
      '../..',
      'node_modules',
      'testcase-helper',
      'testcase-helper.d.ts',
    );
    this.logger.info(`helper: ${modulePath}`);
    const dtscontent = await fs.readFile(modulePath, { encoding: 'utf8' });
    console.log(dtscontent);
    return dtscontent;
  }
  makeTypesFile(oFile: string = null) {
    this.logger.debug(`make test module declare file output:${oFile}`);
    const files = [
      'test-cases/classes/impls/android-device.d.ts',
      'test-cases/classes/impls/web-page.d.ts',
      'test-cases/classes/test-case-base.d.ts',
      'test-cases/classes/test-case-decorator.d.ts',
    ];

    const project = new Project();
    this.logger.info(`current dirname: ${__dirname}`);
    const sourceFiles = files
      .map((filePath) => {
        // Resolve relative path to absolute path based on project root
        const absolutePath = path.resolve(__dirname, '..', filePath);
        // Check if file exists
        this.logger.info(`absolute path: ${absolutePath}`);
        if (!existsSync(absolutePath)) {
          this.logger.error(`File not found: ${absolutePath}`);
          return null;
        }
        try {
          return project.addSourceFileAtPath(absolutePath);
        } catch (error) {
          this.logger.error(
            `Failed to add source file ${absolutePath}: ${(error as Error).message}`,
          );
          return null;
        }
      })
      .filter((sourceFile) => sourceFile !== null);

    const methodDeclarations: string[] = [];
    // Extract function declarations from .d.ts files (e.g., test-decorator.d.ts)
    for (const sourceFile of sourceFiles) {
      // Get all exported declarations (functions, classes, etc.)
      const declarations = sourceFile.getExportedDeclarations();
      for (const [_, decls] of declarations) {
        for (const decl of decls) {
          // Check if the declaration is a function using type guard
          if (decl.isKind(SyntaxKind.FunctionDeclaration)) {
            const func = decl as FunctionDeclaration;
            let declarationText = func.getText();
            // Ensure 'export declare' is included, but avoid duplication
            if (!declarationText.startsWith('export declare')) {
              declarationText = `export declare ${declarationText}`;
            }
            // Ensure it ends with a semicolon
            if (!declarationText.endsWith(';')) {
              declarationText += ';';
            }
            methodDeclarations.push(declarationText);
          }
          // Skip other declarations (e.g., classes like AndroidDevice)
        }
      }
    }
    // Add the TestCase class declaration
    methodDeclarations.push(
      'export declare class TestCase implements ITestBase {',
    );

    // Extract class methods from other files
    for (const sourceFile of sourceFiles) {
      const classes = sourceFile.getClasses();
      for (const cls of classes) {
        const className = cls.getName() || 'UnnamedClass';
        // Extract class method declarations
        const methods = cls
          .getMethods()
          .filter((method) => method.getKind() !== SyntaxKind.Constructor)
          .map((method) => {
            return `${method.getText()};`;
          });
        // Add class name as comment if methods exist
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
    const outputFile = project.createSourceFile(
      './node_modules/@types/test-case.d.ts',
      outputContent,
      { overwrite: true },
    );

    // 保存文件
    outputFile.saveSync();
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

  async generateModule() {
    // 确保输出目录存在

    const inputDir = path.join(
      __dirname,
      '../..',
      'workspace',
      'common_scripts',
    );
    const outDir = path.join(inputDir, './dist');
    const typesDir = `${outDir}/types`;
    const project = new Project({
      compilerOptions: {
        target: ScriptTarget.ESNext,
        module: ModuleKind.CommonJS,
        outDir: outDir,
        rootDir: inputDir, // 源文件根目录
        strict: true, // 启用严格类型检查
        moduleResolution: ModuleResolutionKind.NodeNext, // 模块解析策略
        esModuleInterop: true, // 支持 CommonJS 模块互操作
        declaration: true,
        declarationDir: typesDir,
      },
    });
    project.addSourceFilesAtPaths([
      `${inputDir}/**/*.{ts,}`,
      `!${inputDir}/dist/**/*`,
    ]);
    // 编译并输出
    try {
      const emitResult = await project.emit({ emitOnlyDtsFiles: false });
      const diagnostics = emitResult.getDiagnostics();
      if (diagnostics.length > 0) {
        console.error(
          'Emit diagnostics:',
          diagnostics.map((d) => d.getMessageText()),
        );
      } else {
        console.log(
          `Successfully generated module at ${path.resolve(inputDir)}`,
        );
      }
    } catch (error) {
      console.error(`Error during emit: ${error}`);
    }

    //
    const dtsFiles = await findDtsFiles(typesDir);
    console.log(dtsFiles.join(','));
    combineDtsFiles(dtsFiles, `${outDir}/index.d.ts`);
  }
  async getTestcaseCommon(filepath: string) {
    return readFileSync(filepath, 'utf-8');
  }
}
