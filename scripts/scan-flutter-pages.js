#!/usr/bin/env node
/**
 * Scan a Flutter project for page_* Dart files and extract clickable controls.
 *
 * It generates:
 * - JSON metadata: apps/api/workspace/flutter-page-meta/<branch>.json
 * - Markdown table: docs/flutter-pages/<branch>.md
 *
 * Usage:
 *   node scripts/scan-flutter-pages.js [flutter-project-root] [platform] [language]
 *
 * If flutter-project-root is omitted, it defaults to ~/wks/getter-flutter.
 * platform: android | ios (default: android)
 * language: en | zh | ... (default: en, uses l10n/intl_<language>.arb)
 *
 * Output JSON filename pattern:
 *   <sanitizedBranch>_<platform>_<language>.json
 * e.g.,
 *   release-1.73.0_android_en.json
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function sanitizeBranch(name) {
  if (!name) return 'unknown';
  return String(name).trim().replace(/[^\w.-]+/g, '-');
}

function detectBranch(flutterRoot) {
  try {
    const out = cp.execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: flutterRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    });
    return out.trim();
  } catch {
    return 'unknown';
  }
}

function pascalCaseFromSnake(name) {
  return String(name)
    .split(/[_\-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function walkDir(dir, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkDir(full, files);
    } else if (ent.isFile()) {
      files.push(full);
    }
  }
}

function loadIntlTranslations(flutterRoot, language) {
  if (!language) return null;

  const intlDir = path.join(flutterRoot, 'l10n');
  const fileName = `intl_${language}.arb`;
  const filePath = path.join(intlDir, fileName);

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const map = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('@')) continue;
      if (typeof value === 'string') {
        map[key] = value;
      }
    }
    return map;
  } catch (e) {
    console.warn(
      `Warning: failed to load intl translations for language '${language}' from ${filePath}:`,
      e.message || e,
    );
    return null;
  }
}

function loadAllIntlTranslations(flutterRoot) {
  const intlDir = path.join(flutterRoot, 'l10n');
  let entries;
  try {
    entries = fs.readdirSync(intlDir, { withFileTypes: true });
  } catch {
    return {};
  }

  const all = {};
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    const m = name.match(/^intl_(.+)\.arb$/);
    if (!m) continue;
    const lang = m[1];
    const filePath = path.join(intlDir, name);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      const map = {};
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('@')) continue;
        if (typeof value === 'string') {
          map[key] = value;
        }
      }
      all[lang] = map;
    } catch (e) {
      console.warn(
        `Warning: failed to load intl translations from ${filePath}:`,
        e.message || e,
      );
    }
  }
  return all;
}

function detectEntryFromMain(flutterRoot) {
  const mainPath = path.join(flutterRoot, 'lib', 'main.dart');
  let content;
  try {
    content = fs.readFileSync(mainPath, 'utf-8');
  } catch {
    return { entryPageClass: null, initialRouteConst: null, homeWidget: null };
  }

  let initialRouteConst = null;
  let homeWidget = null;

  // Try to extract initialRoute: InitialPathSplash
  const mRoute = content.match(/initialRoute\s*:\s*([A-Za-z0-9_\.]+)/);
  if (mRoute) {
    const expr = mRoute[1];
    const simple = expr.split('.').pop();
    if (simple) initialRouteConst = simple;
  }

  // Try to extract home: PageXxx(
  const mHome = content.match(/home\s*:\s*([A-Za-z0-9_]+)\s*\(/);
  if (mHome) {
    homeWidget = mHome[1];
  }

  return { entryPageClass: null, initialRouteConst, homeWidget };
}

function findPageClassForRoute(flutterRoot, routeConst) {
  if (!routeConst) return null;
  const routersPath = path.join(flutterRoot, 'lib', 'routers.dart');
  const routerPathFile = path.join(flutterRoot, 'lib', 'router_path.dart');
  let content = '';
  try {
    content += fs.readFileSync(routersPath, 'utf-8');
  } catch {}
  try {
    content += '\n' + fs.readFileSync(routerPathFile, 'utf-8');
  } catch {}
  if (!content) {
    return null;
  }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(routeConst)) continue;
    // Look ahead a few lines for a PageXxx constructor near this route
    for (let j = i; j <= i + 15 && j < lines.length; j++) {
      const line = lines[j];
      const m = line.match(/\b(Page[A-Za-z0-9_]*)\s*\(/);
      if (m) {
        const cls = m[1];
        if (cls !== 'PageRoute' && cls !== 'PageController') {
          return cls;
        }
      }
    }
  }

  return null;
}

function findLabel(lines, idx) {
  const maxOffset = 15;
  const result = { label: null, source: null, localeKey: null };

  for (let direction of [1, -1]) {
    for (let d = 0; d <= maxOffset; d++) {
      const j = idx + direction * d;
      if (j < 0 || j >= lines.length) break;
      const line = lines[j];

      // Text("literal")
      let m = line.match(/Text\(\s*(['"`])(.+?)\1/);
      if (m) {
        result.label = m[2];
        result.source = 'text';
        return result;
      }

      // AppText("literal")
      m = line.match(/AppText\(\s*(['"`])(.+?)\1/);
      if (m) {
        result.label = m[2];
        result.source = 'text';
        return result;
      }

      // locale.xxx / local.xxx
      m = line.match(/\b(loc?:?ale?|locale)\.(\w+)/);
      if (m) {
        result.label = m[2];
        result.source = 'locale';
        result.localeKey = m[2];
        return result;
      }

      // L.of(context).xxx
      m = line.match(/\bL\.of\([^)]*\)\.(\w+)/);
      if (m) {
        result.label = m[1];
        result.source = 'locale';
        result.localeKey = m[1];
        return result;
      }

      // AppLocalizations.of(context).xxx
      m = line.match(/\bAppLocalizations\.of\([^)]*\)\.(\w+)/);
      if (m) {
        result.label = m[1];
        result.source = 'locale';
        result.localeKey = m[1];
        return result;
      }
    }
  }

  return result;
}

function findSelector(lines, idx, label, labelSource) {
  const start = Math.max(0, idx - 5);
  const end = Math.min(lines.length - 1, idx + 25);

  for (let j = start; j <= end; j++) {
    const line = lines[j];
    const m = line.match(/key\s*:\s*(?:const\s*)?(?:ValueKey|Key)\s*\(\s*(['"`])(.+?)\1\)/);
    if (m) {
      return { selectorType: 'byKey', selector: m[2] };
    }
  }

  if (label) {
    return {
      selectorType: 'byText',
      selector: label,
    };
  }

  return { selectorType: 'unknown', selector: '' };
}

function findTarget(lines, idx) {
  const start = idx;
  const end = Math.min(lines.length - 1, idx + 40);
  let route = null;
  let pageClass = null;

  for (let j = start; j <= end; j++) {
    const line = lines[j];
    if (!route) {
      // NavigationMaster.instance.global.navigateTo(PathLoginPassword, ...)
      let m = line.match(/navigateTo\(\s*([A-Za-z0-9_."']+)/);
      if (m) {
        route = m[1].replace(/[,'" ]+/g, '');
      }

      // Navigator.of(context).pushNamed(PathHome)
      if (!route) {
        m = line.match(/pushNamed\(\s*([A-Za-z0-9_."']+)/);
        if (m) {
          route = m[1].replace(/[,'" ]+/g, '');
        }
      }
    }

    if (!pageClass) {
      const m = line.match(/\b(Page[A-Z][A-Za-z0-9_]*)\s*\(/);
      if (m) {
        const name = m[1];
        if (name !== 'PageRoute' && name !== 'PageController') {
          pageClass = name;
        }
      }
    }
  }

  return { route, pageClass };
}

function buildControlId(existingIds, method, label, handlerKind) {
  let base = '';
  if (method) {
    base = String(method).replace(/^_+/, '');
  } else if (label) {
    base = String(label).replace(/[^A-Za-z0-9]+/g, '_');
  } else if (handlerKind) {
    base = handlerKind;
  } else {
    base = 'control';
  }
  if (!base) base = 'control';

  let id = base;
  let suffix = 1;
  while (existingIds.has(id)) {
    id = `${base}_${suffix++}`;
  }
  existingIds.add(id);
  return id;
}

function buildDescription(pageClass, controlId, label, targetInfo) {
  const parts = [];
  parts.push('Tap');
  if (label) {
    parts.push(`"${label}"`);
  } else {
    parts.push(`control '${controlId}'`);
  }

  if (targetInfo.pageClass) {
    parts.push(`to open ${targetInfo.pageClass}.`);
  } else if (targetInfo.route) {
    parts.push(`to navigate to route ${targetInfo.route}.`);
  } else {
    parts.push('to perform its action.');
  }

  return parts.join(' ');
}

function analyzePageFile(
  filePath,
  flutterRoot,
  intlTranslations,
  language,
  platform,
  allIntlTranslations,
) {
  const rel = path.relative(flutterRoot, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  let pageClass = null;
  const m = content.match(/class\s+(\w+)\s+extends\s+(StatefulWidget|StatelessWidget)\b/);
  if (m) {
    pageClass = m[1];
  } else {
    const base = path.basename(filePath, '.dart');
    pageClass = pascalCaseFromSnake(base);
  }

  const controls = [];
  const usedIds = new Set();
  let currentMethod = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const methodMatch = line.match(
      /^\s*(?:@override\s+)?(?:[A-Za-z0-9_<>\[\]?]+[\s*]+)+(_?[A-Za-z0-9_]+)\s*\(/,
    );
    if (methodMatch && !/class\s+/.test(line)) {
      currentMethod = methodMatch[1];
    }

    const handlerMatch = line.match(/\b(onTap|onPressed|onLongPress|onDoubleTap)\s*:/);
    if (!handlerMatch) continue;
    const handlerKind = handlerMatch[1];

    const { label, source, localeKey } = findLabel(lines, i);

    let resolvedLabel = label;
    let labelLocaleKey = null;
    let translations = null;
    if (source === 'locale') {
      const key = localeKey || label;
      labelLocaleKey = key;
      // Build per-language translations map for this key
      if (key && allIntlTranslations) {
        translations = {};
        for (const [lang, map] of Object.entries(allIntlTranslations)) {
          if (map && Object.prototype.hasOwnProperty.call(map, key)) {
            translations[lang] = map[key];
          }
        }
      }
      // Resolve label in the current/default language
      if (!resolvedLabel && intlTranslations && key && intlTranslations[key]) {
        resolvedLabel = intlTranslations[key];
      } else if (!resolvedLabel && translations && translations[language]) {
        resolvedLabel = translations[language];
      }
    }

    const selectorInfo = findSelector(lines, i, resolvedLabel, source);
    const targetInfo = findTarget(lines, i);
    const id = buildControlId(usedIds, currentMethod, label, handlerKind);
    const description = buildDescription(pageClass, id, resolvedLabel, targetInfo);

    controls.push({
      id,
      method: currentMethod,
      handler: handlerKind,
      label: resolvedLabel || null,
      rawLabel: label || null,
      labelSource: source || null,
      labelLocaleKey: labelLocaleKey || null,
      translations: translations || null,
      language: language || null,
      platform: platform || null,
      selectorType: selectorInfo.selectorType,
      selector: selectorInfo.selector || '',
      targetRoute: targetInfo.route || null,
      targetPageClass: targetInfo.pageClass || null,
      description,
      sourceFileLine: i + 1,
    });
  }

  return {
    pageClass,
    pageFile: rel,
    platform: platform || null,
    controls,
  };
}

function escapeMd(text) {
  return String(text ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function generateMarkdown(meta, outPath) {
  const lines = [];
  lines.push(`# Flutter Pages – ${meta.branch}`);
  lines.push('');
  lines.push(`Generated at \`${meta.generatedAt}\` from \`${meta.flutterRoot}\`.`);
  lines.push('');
  lines.push('| Page | Dart File | Flags | Control ID | Label | Selector | Target | Description |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const page of meta.pages) {
    const flags = [];
    if (page.isEntry) flags.push('ENTRY');
    for (const c of page.controls) {
      const selectorSummary = c.selectorType && c.selector
        ? `${c.selectorType}:${c.selector}`
        : c.selectorType || '';
      const targetSummary = [
        c.targetPageClass ? `page=${c.targetPageClass}` : '',
        c.targetRoute ? `route=${c.targetRoute}` : '',
      ]
        .filter(Boolean)
        .join(', ');

      lines.push(
        `| ${escapeMd(page.pageClass)} | ${escapeMd(page.pageFile)} | ${escapeMd(
          flags.join(', '),
        )} | ${escapeMd(c.id)} | ${escapeMd(
          c.label || '',
        )} | ${escapeMd(selectorSummary)} | ${escapeMd(targetSummary)} | ${escapeMd(
          c.description || '',
        )} |`,
      );
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
}

function main() {
  const [, , flutterArg, platformArg, languageArg] = process.argv;
  const defaultRoot = path.join(os.homedir(), 'wks', 'getter-flutter');
  const flutterRoot = path.resolve(flutterArg || process.env.FLUTTER_PROJECT_ROOT || defaultRoot);

  const platform =
    (platformArg || process.env.FLUTTER_PLATFORM || 'android').toString().toLowerCase();
  const language =
    (languageArg || process.env.FLUTTER_LANGUAGE || process.env.FLUTTER_TEXT_LOCALE || 'en')
      .toString()
      .toLowerCase();

  if (!exists(flutterRoot)) {
    console.error(`Flutter project not found at: ${flutterRoot}`);
    process.exit(1);
  }

  const libRoot = path.join(flutterRoot, 'lib');
  if (!exists(libRoot)) {
    console.error(`No lib/ directory under Flutter project: ${libRoot}`);
    process.exit(1);
  }

  const branch = detectBranch(flutterRoot);
  const sanitizedBranch = sanitizeBranch(branch);

  const allIntlTranslations = loadAllIntlTranslations(flutterRoot);
  const intlTranslations = allIntlTranslations[language] || null;

  const dartFiles = [];
  walkDir(libRoot, dartFiles);
  const pageFiles = dartFiles.filter((f) => {
    const name = path.basename(f);
    return /^page_.*\.dart$/.test(name);
  });

  // Detect entry page (app first page) from main.dart + routers.dart
  let entryPageClass = process.env.FLUTTER_ENTRY_PAGE_CLASS || null;
  const mainInfo = detectEntryFromMain(flutterRoot);
  if (!entryPageClass && mainInfo.initialRouteConst) {
    const fromRoute = findPageClassForRoute(flutterRoot, mainInfo.initialRouteConst);
    // Many apps use a Splash page as the initial route; prefer a later
    // usable page if possible, and let callers override via env when needed.
    if (fromRoute && !/splash/i.test(fromRoute)) {
      entryPageClass = fromRoute;
    }
  }
  if (!entryPageClass && mainInfo.homeWidget) {
    entryPageClass = mainInfo.homeWidget;
  }

  const pages = [];
  for (const file of pageFiles) {
    try {
      const pageInfo = analyzePageFile(
        file,
        flutterRoot,
        intlTranslations,
        language,
        platform,
        allIntlTranslations,
      );
      if (pageInfo) {
        pages.push(pageInfo);
      } else if (entryPageClass) {
        // Entry page may have no clickable controls; ensure it is still included.
        // Try to infer its class name from file name if needed.
        const rel = path
          .relative(flutterRoot, file)
          .replace(/\\/g, '/');
        const name = pascalCaseFromSnake(path.basename(file, '.dart'));
        if (name === entryPageClass) {
          pages.push({
            pageClass: name,
            pageFile: rel,
            controls: [],
          });
        }
      }
    } catch (e) {
      console.error(`Failed to analyze ${file}:`, e.message || e);
    }
  }
  if (entryPageClass) {
    for (const p of pages) {
      if (p.pageClass === entryPageClass) {
        p.isEntry = true;
      }
    }
  }

  pages.sort((a, b) => a.pageClass.localeCompare(b.pageClass));

  const meta = {
    branch,
    sanitizedBranch,
    generatedAt: new Date().toISOString(),
    flutterRoot: flutterRoot,
    platform,
    language,
    availableLanguages: Object.keys(allIntlTranslations || {}),
    entryPageClass: entryPageClass || null,
    pages,
  };

  const repoRoot = path.resolve(__dirname, '..');
  const jsonDir = path.join(repoRoot, 'apps', 'api', 'workspace', 'flutter-page-meta');
  const jsonFileBase = `${sanitizedBranch}_${platform}_${language}`;
  const jsonPath = path.join(jsonDir, `${jsonFileBase}.json`);
  fs.mkdirSync(jsonDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf-8');

  // Backwards compatibility: also write legacy branch-only JSON
  const legacyJsonPath = path.join(jsonDir, `${sanitizedBranch}.json`);
  try {
    fs.writeFileSync(legacyJsonPath, JSON.stringify(meta, null, 2), 'utf-8');
  } catch {
    // ignore
  }

  const mdDir = path.join(repoRoot, 'docs', 'flutter-pages');
  const mdPath = path.join(mdDir, `${jsonFileBase}.md`);
  generateMarkdown(meta, mdPath);

  const totalControls = pages.reduce((sum, p) => sum + (p.controls?.length || 0), 0);
  console.log(
    `Scanned Flutter project at ${flutterRoot}\n` +
      `Branch: ${branch} (sanitized: ${sanitizedBranch})\n` +
      `Pages with controls: ${pages.length}, controls: ${totalControls}\n` +
      `JSON: ${jsonPath}\n` +
      `Legacy JSON: ${legacyJsonPath}\n` +
      `Markdown: ${mdPath}`,
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
