import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { AndroidService } from 'src/mobile/android/android.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { SandboxExecutor } from './sandbox-executor';
import { ReportService } from 'src/report/report.service';
import { readFileSync } from 'fs';
import * as esbuild from 'esbuild';
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
  async runcase(clientCode: string, clientId: string, reportDir: string) {
    this.logger.info(`run case clientId:${clientId}`);

    const sandBoxExec = new SandboxExecutor(
      clientId,
      reportDir,
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
  private async bundleTypeScriptFiles(files: {
    [filename: string]: string;
  }): Promise<string> {
    const entryPointName = 'entry.ts';
    const importStatements = Object.keys(files)
      .map((filename) => `import '${filename}';`)
      .join('\n');
    const syntheticEntryContent = `${importStatements}\n`;

    const allFiles = {
      [entryPointName]: syntheticEntryContent,
      ...files,
    };

    const virtualFilePlugin: esbuild.Plugin = {
      name: 'virtual-file',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (args.path === 'test-case') {
            return { path: 'test-case', namespace: 'virtual', external: true };
          }
          const resolvedPath = Object.keys(allFiles).find(
            (f) =>
              f === args.path ||
              f === `${args.path}.ts` ||
              f === `${args.path}/index.ts`,
          );
          if (resolvedPath) {
            return { path: resolvedPath, namespace: 'virtual' };
          }
          throw new Error(`Cannot resolve module ${args.path}`);
        });

        build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
          const fileContent = allFiles[args.path];
          if (!fileContent) {
            throw new Error(`File ${args.path} not found`);
          }
          return { contents: fileContent, loader: 'ts' };
        });
      },
    };

    const result = await esbuild.build({
      entryPoints: [entryPointName],
      bundle: true,
      write: false,
      platform: 'node',
      target: 'es2020',
      format: 'cjs',
      sourcemap: false,
      plugins: [virtualFilePlugin],
    });

    if (result.outputFiles && result.outputFiles.length > 0) {
      return result.outputFiles[0].text;
    }
    throw new Error('Bundling produced no output');
  }
  async executeTestFiles(
    files: { [filename: string]: string },
    clientId: string,
    workspace: string = './workspace/Anonymouse',
  ): Promise<void> {
    this.logger.info(`run runcaseForBoundle clientId:${clientId}`);
    let bundledCode: string;
    try {
      bundledCode = await this.bundleTypeScriptFiles(files);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.sendErrorTo(clientId, `Bundling failed: ${errorMsg}`);
      throw err;
    }
    const sandBoxExec = new SandboxExecutor(
      clientId,
      workspace,
      this.reportService,
      this.loggerService,
      this.androidService,
    );
    try {
      await sandBoxExec.executeWithBundle(bundledCode);
    } catch (err) {
      this.logger.sendErrorTo(clientId, `Exception in case: ${err}`);
      this.logger.sendLogTo(clientId, `Exception in case: ${err}`);
      this.logger.sendExitTo(clientId);
    }
  }
  async executeFile(path: string, clientId: string, reportDir: string) {
    try {
      const code = readFileSync(path);
      await this.runcase(code.toString(), clientId, reportDir);
    } catch (err) {
      this.logger.sendErrorTo(clientId, `${err}`);
    }
  }
}
