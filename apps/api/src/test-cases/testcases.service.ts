import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { AndroidService } from 'src/mobile/android/android.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { ReportService } from 'src/report/report.service';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import path from 'path';
import * as vm from 'vm';
import { Project } from 'ts-morph';
import { getErrorMessage } from 'src/common/utils';
import { BrowserHelper } from 'src/browser/browser-helper';

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
  async getInterfaces() {
    const coreLibPath = path.join(
      __dirname,
      '../..',
      process.env.CORE_LIB_DIR || 'workspace/shared-libs/core',
      'index.ts',
    );
    const gettrLibPath = path.join(
      __dirname,
      '../..',
      process.env.GETTR_LIB_DIR || 'workspace/shared-libs/gettr',
      'index.ts',
    );
    this.logger.info(`corelib:${coreLibPath}\ngettrlib:${gettrLibPath}`);
    try {
      const coreInterface = fs.readFileSync(coreLibPath, 'utf-8');
      const gettrInterface = fs.readFileSync(gettrLibPath, 'utf-8');
      console.log(coreInterface);
      return [{ 'core-lib': coreInterface }, { 'gettr-lib': gettrInterface }];
    } catch (err) {
      this.logger.error(getErrorMessage(err));
      throw err;
    }
  }

  async transformCode(code: string): Promise<string> {
    try {
      const result = await esbuild.transform(code, {
        loader: 'ts', // 支持 TypeScript
        format: 'cjs', // 输出 CommonJS
        platform: 'node',
        // external: ['core-lib', 'gettr-lib'] as string[], // 排除 core-lib 和 gettr-lib，保留 require 调用
        sourcemap: false,
        minify: false,
        target: 'esnext',
        tsconfigRaw: {
          compilerOptions: {
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
        },
      } as esbuild.TransformOptions);
      return result.code;
    } catch (error) {
      console.error('Failed to transform code with esbuild:', error);
      throw error;
    }
  }
  async runInSandbox(code: string, clientId?: string): Promise<any> {
    this.logger.debug('runInSandbox');
    let transformedCode = '';
    let coreLib: any;
    let gettrLib: any;
    try {
      transformedCode = await this.transformCode(code);
      // 加载 core-lib
      coreLib = await this.loadCoreLib();
      gettrLib = await this.loadGettrLib();
    } catch (err) {
      this.logger.complete(clientId);
      return;
    }
    // 创建沙盒上下文
    const sandbox: any = {
      require: (moduleName: string) => {
        if (moduleName === 'core-lib') {
          return coreLib;
        }
        if (moduleName === 'gettr-lib') {
          return gettrLib;
        }
        return require(moduleName);
        //throw new Error(`Module ${moduleName} not found in sandbox`);
      },
      module: { exports: {} },
      exports: {},
      params: {
        workspace: process.env.WORKSPACE,
        clientId,
        loggerService: this.loggerService,
        browserHelper: new BrowserHelper(),
      }, // 注入传入的参数
      console, // 注入 console 以支持 console.log
      coreMain: coreLib.main,
    };
    // 创建隔离的上下文
    const context = vm.createContext(sandbox);
    // 包装代码
    const wrappedCode = `
      ${transformedCode}
      coreMain(params)
    `;

    try {
      const script = new vm.Script(wrappedCode, { filename: 'testcase.js' });
      script.runInContext(context);
      return context.result; // 返回结果
    } catch (error) {
      console.error('Sandbox execution failed:', error);
      throw error;
    }
  }
  async loadCoreLib() {
    const coreLibPath = path.join(
      __dirname,
      '../..',
      process.env.CORE_LIB_DIR || 'workspace/shared-libs/core',
      'dist/index.js',
    );
    try {
      if (!fs.existsSync(coreLibPath)) {
        throw new Error(
          `core-lib not found at ${coreLibPath}. Please generate core-lib first.`,
        );
      }
      const module = await import(coreLibPath);
      return module;
    } catch (error) {
      console.error('Failed to load core-lib:', error);
      throw error;
    }
  }
  async loadGettrLib() {
    const coreLibPath = path.join(
      __dirname,
      '../..',
      process.env.GETTR_LIB_DIR || 'workspace/shared-libs/gettr',
      '/dist/index.js',
    );
    try {
      if (!fs.existsSync(coreLibPath)) {
        throw new Error(
          `core-lib not found at ${coreLibPath}. Please generate gettr-lib first.`,
        );
      }
      const module = await import(coreLibPath);
      return module;
    } catch (error) {
      console.error('Failed to load core-lib:', error);
      throw error;
    }
  }
  async buildGettrLib(clientId?: string) {
    console.log('libdir:', process.env.GETTR_LIB_DIR);
    const coreDir = path.join(
      __dirname,
      '../..',
      process.env.GETTR_LIB_DIR || 'workspace/shared-libs/gettr',
    );
    const outputDir = path.join(coreDir, 'dist');
    const srcDir = path.join(coreDir, 'src');
    const indexPath = path.join(coreDir, 'index.ts');
    this.logger.debug(
      `coredir: ${coreDir}, outDir:${outputDir}, srcDir:${srcDir}, indexPath:${indexPath}`,
    );
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    this.generateIndexWithTsMorph(coreDir, srcDir, indexPath);
    const result = await this.buildWithEsbuild(indexPath, outputDir);
    clientId && this.logger.sendTo(clientId, `gettr lib ${result}`, 'info');
  }

  async buildCoreLib(clientId?: string) {
    console.log('libdir:', process.env.CORE_LIB_DIR);
    const coreDir = path.join(
      __dirname,
      '../..',
      process.env.CORE_LIB_DIR || 'workspace/shared-libs/core',
    );
    const outputDir = path.join(coreDir, 'dist');
    const srcDir = path.join(coreDir, 'src');
    const indexPath = path.join(coreDir, 'index.ts');
    // 清空输出目录
    this.logger.debug(
      `coredir: ${coreDir}, outDir:${outputDir}, indexPath:${indexPath}`,
    );
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    await this.generateIndexWithTsMorph(coreDir, srcDir, indexPath);
    const result = await this.buildWithEsbuild(indexPath, outputDir);
    clientId && this.logger.sendTo(clientId, `core lib ${result}`, 'info');
  }
  async generateIndexWithTsMorph(
    coreDir: string,
    srcDir: string,
    indexPath: string,
  ) {
    const project = new Project({
      tsConfigFilePath: path.join(coreDir, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });

    project.addSourceFilesAtPaths([`${srcDir}/*.ts`]);

    // 收集导出的符号
    const exportStatements: string[] = [];
    const files = [...project.getSourceFiles(`${srcDir}/*.ts`)];

    files.forEach((file) => {
      const filePath = file.getFilePath();
      const relativePath = path
        .relative(coreDir, filePath)
        .replace(/\.ts$/, '');
      const exports = file.getExportSymbols();

      if (exports.length > 0) {
        const exportNames = exports.map((exp) => exp.getName()).join(', ');
        exportStatements.push(
          `export { ${exportNames} } from './${relativePath}';`,
        );
      }
    });

    const indexContent = `// Auto-generated index.ts for lib\n${exportStatements.join('\n')}`;
    fs.writeFileSync(indexPath, indexContent);

    console.log('Generated index.ts using ts-morph');
    console.log('Export statements:', exportStatements);
  }

  async buildWithEsbuild(indexPath: string, outputDir: string) {
    const buildOptions: esbuild.BuildOptions = {
      entryPoints: [indexPath], // 从 index.ts 开始
      bundle: true,
      outdir: outputDir,
      format: 'esm',
      platform: 'node',
      sourcemap: false,
      minify: false,
      loader: {
        '.ts': 'ts', // TypeScript loader
      },
      external: ['node:*'],
      write: true,
    };

    try {
      const result = await esbuild.build(buildOptions);
      if (result.errors.length > 0) {
        console.error('Esbuild errors:', result.errors);
      }
      const files = fs.readdirSync(outputDir);
      if (files.length === 0) {
        throw new Error(
          `No files found in ${outputDir}. Build may have failed.`,
        );
      }
      console.log(`Built lib to ${outputDir}:`, files);

      return `build succssfully`;
    } catch (error) {
      console.error('Build failed:', error);
    } finally {
      esbuild.stop();
    }
  }
}
