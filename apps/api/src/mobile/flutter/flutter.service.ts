import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggerService } from 'src/logger/logger.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { FlutterControlMeta, FlutterMeta, FlutterPageMeta } from './types';

export type GeneratedMethodInfo = {
  name: string;
  returnType: string;
  description: string;
  selectorType: string | null;
  selector: string | null;
  targetRoute: string | null;
  targetPageClass: string | null;
};

export type GeneratedPageInfo = {
  dartPageClass: string;
  dartFile: string;
  tsClass: string;
  filePath: string;
  isEntry?: boolean;
  methods: GeneratedMethodInfo[];
  platform?: string | null;
  language?: string | null;
};

@Injectable()
export class FlutterService {
  private readonly logger: CustomLogger;

  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('FlutterService');
  }

  private sanitizeBranch(name: string | undefined | null): string {
    if (!name) return 'unknown';
    return String(name).trim().replace(/[^\w.-]+/g, '-');
  }

  private pascalToKebab(name: string): string {
    return String(name)
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .toLowerCase();
  }

  private toPascalCase(name: string): string {
    return String(name)
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');
  }

  private dartPageToTsClass(pageClass: string): string {
    const name = String(pageClass || '');
    if (name.startsWith('Page') && name.length > 4) {
      return name.slice(4) + 'Page';
    }
    if (name.endsWith('Page')) {
      return name;
    }
    return name + 'Page';
  }

  private selectorToWdio(control: FlutterControlMeta, language?: string | null): string {
    const type = control.selectorType || '';
    let value = control.selector || '';
    if (type === 'byText') {
      const translations = (control as any).translations as
        | Record<string, string>
        | null
        | undefined;
      if (language && translations && translations[language]) {
        value = translations[language];
      } else if (!value && control.label) {
        value = control.label;
      }
    }
    if (type === 'byKey') {
      return `flutter:byValueKey(${JSON.stringify(value)})`;
    }
    if (type === 'byText') {
      return `//*[@text=${JSON.stringify(value)}]`;
    }
    if (type === 'raw') {
      return value;
    }
    return value;
  }

  private buildMethodName(control: FlutterControlMeta): string {
    const baseSource = control.id || control.label || control.method || 'control';
    const clean = String(baseSource).replace(/[^A-Za-z0-9]+/g, '_');
    const pascal = this.toPascalCase(clean || 'control');
    return `tap${pascal}`;
  }

  private makeNamespaceName(sanitizedBranch: string): string {
    const base = String(sanitizedBranch || '').trim();
    let name = base.replace(/[^A-Za-z0-9]+/g, '_');
    if (!/^[A-Za-z_]/.test(name)) {
      name = `v_${name}`;
    }
    return name;
  }

  private async ensureIPage(srcRoot: string) {
    const interfaceDir = path.join(srcRoot, 'interface');
    const filePath = path.join(interfaceDir, 'ipage.ts');
    try {
      await fs.access(filePath);
      return;
    } catch {
      // fall through
    }
    await fs.mkdir(interfaceDir, { recursive: true });
    const content = `import { TestCase } from '../../../core/src/test-case-base';

export class IPage {
  protected testcase: any;

  constructor(testInstance: any) {
    this.testcase = testInstance;
  }

  async delay(ms?: number) {
    const sleep = (v: number) => new Promise((resolve) => setTimeout(resolve, v));
    await sleep(ms ? ms : this.delayTime);
  }

  get delayTime() {
    return this.testcase.delaytime;
  }

  get page() {
    return this.testcase.page;
  }

  get logger() {
    return this.testcase.logger;
  }
}
`;
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async generateFromMeta(meta: FlutterMeta) {
    if (!meta || !Array.isArray(meta.pages)) {
      throw new BadRequestException('Invalid Flutter page metadata: pages is missing or not an array');
    }

    const branch = meta.branch || meta.sanitizedBranch || 'unknown';
    const sanitizedBranch = meta.sanitizedBranch || this.sanitizeBranch(branch);
    const platform = (meta.platform || 'android').toString().toLowerCase();
    const language =
      (meta.language ||
        process.env.FLUTTER_LANGUAGE ||
        process.env.FLUTTER_TEXT_LOCALE ||
        'en')!
        .toString()
        .toLowerCase();

    // Persist back normalized platform/language so the client can see what was used.
    meta.platform = platform;
    meta.language = language;

    const libName = platform === 'ios' ? 'gettr-ios' : 'gettr-android';
    const libRoot = path.resolve(process.cwd(), 'workspace', 'shared-libs', libName);
    const srcRoot = path.join(libRoot, 'src');
    await this.ensureIPage(srcRoot);
    const branchRoot = path.join(srcRoot, sanitizedBranch);
    const outDir = path.join(branchRoot, language);
    await fs.mkdir(outDir, { recursive: true });

    const results: GeneratedPageInfo[] = [];

    for (const page of meta.pages) {
      const info = await this.generatePageFile(meta, page, outDir);
      results.push(info);
    }

    // Per-language barrel: src/<branch>/<language>/index.ts
    try {
      const indexPath = path.join(outDir, 'index.ts');
      const lines = results.map((p) => {
        const fileBase = path.basename(p.filePath).replace(/\.ts$/i, '');
        return `export { ${p.tsClass} } from './${fileBase}';`;
      });
      await fs.writeFile(indexPath, lines.join('\n') + '\n', 'utf-8');
    } catch (err: any) {
      this.logger.error(
        `Failed to write language index.ts for ${sanitizedBranch}/${language}: ${
          err?.message || String(err)
        }`,
      );
    }

    // Per-branch barrel: src/<branch>/index.ts -> re-export default language
    try {
      const branchIndexPath = path.join(branchRoot, 'index.ts');
      const relLangPath = `./${language}`;
      const branchContent = `export * from '${relLangPath}';\n`;
      await fs.writeFile(branchIndexPath, branchContent, 'utf-8');
    } catch (err: any) {
      this.logger.error(
        `Failed to write branch index.ts for ${sanitizedBranch}: ${err?.message || String(err)}`,
      );
    }

    // Ensure namespace export in <libName>/index.ts
    try {
      const indexPath = path.join(libRoot, 'index.ts');
      let content = '';
      try {
        content = await fs.readFile(indexPath, 'utf-8');
      } catch {
        content = '// Auto-generated index.ts for lib\n';
      }
      const nsName = this.makeNamespaceName(sanitizedBranch);
      const relPath = `./src/${sanitizedBranch}`;
      const exportLine = `export * as ${nsName} from '${relPath}';`;
      if (!content.includes(exportLine)) {
        if (content && !content.endsWith('\n')) content += '\n';
        content += exportLine + '\n';
      }

      // Also expose per-language namespace, e.g. release_1_73_0_en
      const langSuffix = language.replace(/[^A-Za-z0-9]+/g, '_');
      let nsLang = `${nsName}_${langSuffix}`;
      if (!/^[A-Za-z_]/.test(nsLang)) {
        nsLang = `v_${nsLang}`;
      }
      const relLangPath = `./src/${sanitizedBranch}/${language}`;
      const exportLangLine = `export * as ${nsLang} from '${relLangPath}';`;
      if (!content.includes(exportLangLine)) {
        if (content && !content.endsWith('\n')) content += '\n';
        content += exportLangLine + '\n';
      }

      await fs.writeFile(indexPath, content, 'utf-8');
    } catch (err: any) {
      this.logger.error(
        `Failed to update ${libName}/index.ts for ${sanitizedBranch}: ${
          err?.message || String(err)
        }`,
      );
    }

    this.logger.info(
      `Generated ${results.length} Flutter page-object files under ${path.relative(
        process.cwd(),
        outDir,
      )} (branch=${branch}, sanitized=${sanitizedBranch})`,
    );

    return {
      result: 'ok',
      branch,
      sanitizedBranch,
      outDir: path.relative(process.cwd(), outDir),
      pages: results,
      platform,
      language,
    };
  }

  private async generatePageFile(
    meta: FlutterMeta,
    page: FlutterPageMeta,
    outDir: string,
  ): Promise<GeneratedPageInfo> {
    const dartPageClass = page.pageClass;
    const dartFile = page.pageFile;
    const tsClass = this.dartPageToTsClass(dartPageClass);
    const fileBase = this.pascalToKebab(tsClass);
    const filePath = path.join(outDir, `${fileBase}.ts`);
    const relPath = path.relative(process.cwd(), filePath);

    const imports: string[] = [];
    imports.push(`import { IPage } from '../interface/ipage';`);

    const targetPages = new Set<string>();
    for (const c of page.controls || []) {
      if (c.targetPageClass && c.targetPageClass !== dartPageClass) {
        targetPages.add(c.targetPageClass);
      }
    }

    const targetImportMap: Record<string, string> = {};
    for (const dartTarget of targetPages) {
      const tsTarget = this.dartPageToTsClass(dartTarget);
      const targetFileBase = this.pascalToKebab(tsTarget);
      imports.push(`import { ${tsTarget} } from './${targetFileBase}';`);
      targetImportMap[dartTarget] = tsTarget;
    }

    const body: string[] = [];
    const methods: GeneratedMethodInfo[] = [];

    body.push(`export class ${tsClass} extends IPage {`);
    body.push(`  constructor(testcase: any) {`);
    body.push(`    super(testcase);`);
    body.push(`  }`);
    body.push('');

    const usedMethodNames = new Set<string>();

    for (const c of page.controls || []) {
      const methodNameBase = this.buildMethodName(c);
      let methodName = methodNameBase;
      let suffix = 1;
      while (usedMethodNames.has(methodName)) {
        methodName = `${methodNameBase}_${suffix++}`;
      }
      usedMethodNames.add(methodName);

      const tsTargetClass =
        c.targetPageClass && targetImportMap[c.targetPageClass]
          ? targetImportMap[c.targetPageClass]
          : null;
      const returnType = tsTargetClass || 'this';
      const selectorLiteral = this.selectorToWdio(c, meta.language);

      const description = c.description || 'Tap control.';
      const selectorType = c.selectorType || null;
      const selector = c.selector || null;
      const targetRoute = c.targetRoute || null;
      const targetPageClass = c.targetPageClass || null;

      body.push(`  /**`);
      body.push(`   * ${description}`);
      if (selectorType && selector) {
        body.push(`   * Selector (${selectorType}): ${selector}`);
      }
      if (targetRoute || targetPageClass) {
        const targetParts: string[] = [];
        if (targetPageClass) targetParts.push(`page=${targetPageClass}`);
        if (targetRoute) targetParts.push(`route=${targetRoute}`);
        body.push(`   * Target: ${targetParts.join(', ')}`);
      }
      if (c.sourceFileLine != null) {
        body.push(`   * Source: ${dartFile}:${c.sourceFileLine}`);
      }
      body.push(`   */`);

      if (!selectorLiteral) {
        body.push(`  async ${methodName}(): Promise<${returnType}> {`);
        body.push(`    // TODO: selector not detected automatically for this control.`);
        if (tsTargetClass) {
          body.push(`    return new ${tsTargetClass}(this.testcase);`);
        } else {
          body.push(`    return this;`);
        }
        body.push(`  }`);
        body.push('');
      } else {
        body.push(`  async ${methodName}(): Promise<${returnType}> {`);
        body.push(`    const el = await this.page.$(${JSON.stringify(selectorLiteral)});`);
        body.push(`    await el.click();`);
        if (tsTargetClass) {
          body.push(`    return new ${tsTargetClass}(this.testcase);`);
        } else {
          body.push(`    return this;`);
        }
        body.push(`  }`);
        body.push('');
      }

      methods.push({
        name: methodName,
        returnType,
        description,
        selectorType,
        selector,
        targetRoute,
        targetPageClass,
      });
    }

    body.push(`}`);

    const content = [imports.join('\n'), '', body.join('\n')].join('\n');
    await fs.writeFile(filePath, content, 'utf-8');

    this.logger.debug(`Generated Flutter page-object: ${relPath}`);

    return {
      dartPageClass,
      dartFile,
      tsClass,
      filePath: relPath,
      isEntry: !!page.isEntry,
      methods,
      platform: meta.platform ?? null,
      language: meta.language ?? null,
    };
  }

  private getMetaDir() {
    return path.resolve(process.cwd(), 'workspace', 'flutter-page-meta');
  }

  async listMetaFiles() {
    const dir = this.getMetaDir();
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return [];
    }

    const items: Array<{
      branch: string | null;
      sanitizedBranch: string;
      filePath: string;
      platform?: string | null;
      language?: string | null;
    }> = [];
    for (const name of entries) {
      if (!name.toLowerCase().endsWith('.json')) continue;
      const full = path.join(dir, name);
      const rel = path.relative(process.cwd(), full);
      let branch: string | null = null;
      let platform: string | null = null;
      let language: string | null = null;
      try {
        const raw = await fs.readFile(full, 'utf-8');
        const meta = JSON.parse(raw) as FlutterMeta;
        branch = (meta.branch ?? meta.sanitizedBranch ?? null) || null;
        platform = meta.platform ?? null;
        language = meta.language ?? null;
      } catch {
        // ignore parse errors, still expose file by filename
      }
      const base = name.replace(/\.json$/i, '');
      items.push({
        branch,
        // Use filename (without .json) as sanitizedBranch so that
        // files for the same branch but different platform/language
        // remain distinguishable, e.g.:
        //   release-1.73.0_android_en
        //   release-1.73.0_android_zh
        sanitizedBranch: base,
        filePath: rel,
        platform,
        language,
      });
    }

    items.sort((a, b) => a.sanitizedBranch.localeCompare(b.sanitizedBranch));
    return items;
  }

  async generateFromStoredMeta(
    sanitizedBranch: string,
    overrides?: { platform?: string | null; language?: string | null },
  ) {
    const normalized = this.sanitizeBranch(sanitizedBranch);
    const dir = this.getMetaDir();
    const filePath = path.join(dir, `${normalized}.json`);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      throw new BadRequestException(`Metadata file not found for branch: ${normalized}`);
    }
    let meta: FlutterMeta;
    try {
      meta = JSON.parse(raw) as FlutterMeta;
    } catch (err: any) {
      throw new BadRequestException(
        `Invalid JSON in metadata file for branch ${normalized}: ${err?.message || String(err)}`,
      );
    }
    if (!meta.sanitizedBranch) {
      meta.sanitizedBranch = normalized;
    }
    if (overrides?.platform) {
      meta.platform = overrides.platform;
    }
    if (overrides?.language) {
      meta.language = overrides.language;
    }
    return this.generateFromMeta(meta);
  }

  async getMetaByBranch(sanitizedBranch: string): Promise<FlutterMeta> {
    const normalized = this.sanitizeBranch(sanitizedBranch);
    const dir = this.getMetaDir();
    const filePath = path.join(dir, `${normalized}.json`);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      throw new BadRequestException(`Metadata file not found for branch: ${normalized}`);
    }
    try {
      const meta = JSON.parse(raw) as FlutterMeta;
      if (!meta.sanitizedBranch) {
        meta.sanitizedBranch = normalized;
      }
      return meta;
    } catch (err: any) {
      throw new BadRequestException(
        `Invalid JSON in metadata file for branch ${normalized}: ${err?.message || String(err)}`,
      );
    }
  }
}
