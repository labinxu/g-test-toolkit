#!/usr/bin/env node
/**
 * Generate TypeScript PageObject classes for the Flutter app
 * based on metadata JSON produced by scan-flutter-pages.js.
 *
 * Usage:
 *   node scripts/gen-flutter-page-objects.js <branchName> [platform] [language]
 *
 * It reads:
 *   apps/api/workspace/flutter-page-meta/<sanitizedBranch>.json
 *
 * And writes:
 *   apps/api/workspace/shared-libs/gettr-android|gettr-ios/src/<sanitizedBranch>/<language>/*.ts
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

function sanitizeBranch(name) {
  if (!name) return 'unknown';
  return String(name).trim().replace(/[^\w.-]+/g, '-');
}

function pascalToKebab(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function toPascalCase(name) {
  return String(name)
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function dartPageToTsClass(pageClass) {
  const name = String(pageClass || '');
  if (name.startsWith('Page') && name.length > 4) {
    return name.slice(4) + 'Page';
  }
  if (name.endsWith('Page')) {
    return name;
  }
  return name + 'Page';
}

function selectorToWdio(control, language) {
  const type = control.selectorType;
  let value = control.selector || '';
  if (type === 'byText') {
    const translations = control.translations || null;
    if (language && translations && translations[language]) {
      value = translations[language];
    } else if (!value && control.label) {
      value = control.label;
    }
  }
  if (type === 'byKey') {
    // Flutter driver by ValueKey
    return `flutter:byValueKey(${JSON.stringify(value)})`;
  }
  if (type === 'byText') {
    // Generic text selector; adapt as needed.
    return `//*[@text=${JSON.stringify(value)}]`;
  }
  if (type === 'raw') {
    return value;
  }
  return value || '';
}

function buildMethodName(control) {
  const baseSource = control.id || control.label || control.method || 'control';
  const clean = String(baseSource).replace(/[^A-Za-z0-9]+/g, '_');
  const pascal = toPascalCase(clean || 'control');
  return `tap${pascal}`;
}

function ensureIPage(outRoot) {
  const interfaceDir = path.join(outRoot, 'interface');
  const filePath = path.join(interfaceDir, 'ipage.ts');
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(interfaceDir, { recursive: true });
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
  fs.writeFileSync(filePath, content, 'utf-8');
}

function makeNamespaceName(sanitizedBranch) {
  const base = String(sanitizedBranch || '').trim();
  let name = base.replace(/[^A-Za-z0-9]+/g, '_');
  if (!/^[A-Za-z_]/.test(name)) {
    name = `v_${name}`;
  }
  return name;
}

function generatePageFile(meta, page, outDir, language) {
  const dartPageClass = page.pageClass;
  const tsClass = dartPageToTsClass(dartPageClass);
  const fileBase = pascalToKebab(tsClass);
  const outPath = path.join(outDir, `${fileBase}.ts`);

  const imports = [];
  imports.push(`import { IPage } from '../interface/ipage';`);

  const targetPages = new Set();
  for (const c of page.controls || []) {
    if (c.targetPageClass && c.targetPageClass !== dartPageClass) {
      targetPages.add(c.targetPageClass);
    }
  }

  const targetImportMap = {};
  for (const dartTarget of targetPages) {
    const tsTarget = dartPageToTsClass(dartTarget);
    const targetFileBase = pascalToKebab(tsTarget);
    imports.push(`import { ${tsTarget} } from './${targetFileBase}';`);
    targetImportMap[dartTarget] = tsTarget;
  }

  const body = [];
  body.push(`export class ${tsClass} extends IPage {`);
  body.push(`  constructor(testcase: any) {`);
  body.push(`    super(testcase);`);
  body.push(`  }`);
  body.push('');

  const usedMethodNames = new Set();

  for (const c of page.controls || []) {
    const methodNameBase = buildMethodName(c);
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
    const returnType = tsTargetClass ? tsTargetClass : 'this';
    const selectorLiteral = selectorToWdio(c, language);

    body.push(`  /**`);
    body.push(`   * ${c.description || 'Tap control.'}`);
    if (c.selectorType && c.selector) {
      body.push(
        `   * Selector (${c.selectorType}): ${c.selector}`,
      );
    }
    if (c.targetPageClass || c.targetRoute) {
      const targetParts = [];
      if (c.targetPageClass) targetParts.push(`page=${c.targetPageClass}`);
      if (c.targetRoute) targetParts.push(`route=${c.targetRoute}`);
      body.push(`   * Target: ${targetParts.join(', ')}`);
    }
    if (c.pageFileLine) {
      body.push(`   * Source: ${page.pageFile}:${c.pageFileLine}`);
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
      continue;
    }

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

  body.push(`}`);

  const content = [imports.join('\n'), '', body.join('\n')].join('\n');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf-8');
  return { outPath, tsClass, fileBase };
}

function main() {
  const [, , branchArg, platformArg, languageArg] = process.argv;
  if (!branchArg) {
    console.error(
      'Usage: node scripts/gen-flutter-page-objects.js <branchName> [platform] [language]',
    );
    process.exit(2);
  }

  const sanitizedBranch = sanitizeBranch(branchArg);
  const repoRoot = path.resolve(__dirname, '..');
  const metaPath = path.join(
    repoRoot,
    'apps',
    'api',
    'workspace',
    'flutter-page-meta',
    `${sanitizedBranch}.json`,
  );

  if (!fs.existsSync(metaPath)) {
    console.error(`Metadata JSON not found: ${metaPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(metaPath, 'utf-8');
  let meta;
  try {
    meta = JSON.parse(raw);
  } catch (e) {
    console.error(`Invalid JSON in ${metaPath}:`, e.message || e);
    process.exit(1);
  }

  const platform = (platformArg || process.env.FLUTTER_PLATFORM || meta.platform || 'android')
    .toString()
    .toLowerCase();
  const language = (
    languageArg ||
    process.env.FLUTTER_LANGUAGE ||
    process.env.FLUTTER_TEXT_LOCALE ||
    meta.language ||
    'en'
  )
    .toString()
    .toLowerCase();

  const libName = platform === 'ios' ? 'gettr-ios' : 'gettr-android';
  const libRoot = path.join(
    repoRoot,
    'apps',
    'api',
    'workspace',
    'shared-libs',
    libName,
  );
  const srcRoot = path.join(libRoot, 'src');
  ensureIPage(srcRoot);

  const branchRoot = path.join(srcRoot, sanitizedBranch);
  const outDir = path.join(branchRoot, language);
  fs.mkdirSync(outDir, { recursive: true });

  const generated = [];
  const pageInfos = [];
  for (const page of meta.pages || []) {
    const info = generatePageFile(meta, page, outDir, language);
    generated.push(info.outPath);
    pageInfos.push(info);
  }

  // Write per-language barrel: src/<branch>/<language>/index.ts
  try {
    const indexPath = path.join(outDir, 'index.ts');
    const lines = pageInfos.map((p) => {
      return `export { ${p.tsClass} } from './${p.fileBase}';`;
    });
    fs.writeFileSync(indexPath, lines.join('\n') + '\n', 'utf-8');
  } catch (e) {
    console.error('Failed to write language index.ts:', e?.message || e);
  }

  // Write / update per-branch barrel: src/<branch>/index.ts -> re-export from default language
  try {
    const branchIndexPath = path.join(branchRoot, 'index.ts');
    const relLangPath = `./${language}`;
    const content = `export * from '${relLangPath}';\n`;
    fs.writeFileSync(branchIndexPath, content, 'utf-8');
  } catch (e) {
    console.error('Failed to write branch index.ts:', e?.message || e);
  }

  // Ensure namespace export in <libName>/index.ts
  try {
    const indexPath = path.join(libRoot, 'index.ts');
    let content;
    try {
      content = fs.readFileSync(indexPath, 'utf-8');
    } catch {
      content = '// Auto-generated index.ts for lib\n';
    }
    const nsName = makeNamespaceName(sanitizedBranch);
    const relPath = `./src/${sanitizedBranch}`;
    const exportLine = `export * as ${nsName} from '${relPath}';`;
    if (!content.includes(exportLine)) {
      if (!content.endsWith('\n')) content += '\n';
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
      if (!content.endsWith('\n')) content += '\n';
      content += exportLangLine + '\n';
    }

    fs.writeFileSync(indexPath, content, 'utf-8');
  } catch (e) {
    console.error(`Failed to update ${libName}/index.ts:`, e?.message || e);
  }

  console.log(
    `Generated ${generated.length} page object files under ${outDir}\n` +
      generated.map((p) => ` - ${p}`).join('\n'),
  );
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e?.stack || String(e));
    process.exit(1);
  }
}
