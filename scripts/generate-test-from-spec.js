#!/usr/bin/env node
/**
 * Generate a TypeScript test file from a JSON spec.
 *
 * Usage:
 *   node scripts/generate-test-from-spec.js path/to/spec.json path/to/output.ts
 *
 * Spec example (JSON):
 * {
 *   "suite": "APPLogin",
 *   "module": "android", // or custom module name
 *   "userDir": "users/labin",
 *   "tags": ["REQ-123"],
 *   "android": { "deviceName": "emulator-5554" }, // optional
 *   "cases": [
 *     {
 *       "title": "启动后展示登录页",
 *       "steps": [
 *         { "action": "tap", "selector": "~登录" },
 *         { "action": "type", "selector": "#username", "text": "user1" },
 *         { "action": "type", "selector": "#password", "text": "pass" }
 *       ],
 *       "expects": [
 *         { "type": "visible", "selector": "~Home" }
 *       ]
 *     }
 *   ]
 * }
 */
const fs = require('fs');
const path = require('path');

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${file}: ${e}`);
  }
}

function q(str) {
  return String(str ?? '').replace(/[\\`$]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
}

function genStep(step) {
  const action = String(step?.action || '').toLowerCase();
  const sel = step?.selector ? String(step.selector) : '';
  const text = step?.text != null ? String(step.text) : '';
  const ms = Number(step?.duration || 800);
  if (!sel && (action === 'tap' || action === 'click' || action === 'press' || action === 'longpress' || action === 'type' || action === 'clear')) {
    return `// TODO: missing selector for action: ${action}`;
  }
  switch (action) {
    case 'tap':
    case 'click':
    case 'press':
      return `await (await tc.page.$(${JSON.stringify(sel)})).click()`;
    case 'longpress':
    case 'long-press':
      return `await (await tc.page.$(${JSON.stringify(sel)})).touchAction({ action: 'longPress', duration: ${Math.max(200, Math.min(3000, ms || 800))} })`;
    case 'type':
      return `{
  const el = await tc.page.$(${JSON.stringify(sel)});
  await el.click();
  await el.setValue(${JSON.stringify(text)});
}`;
    case 'clear':
      return `await (await tc.page.$(${JSON.stringify(sel)})).clearValue()`;
    case 'wait-visible':
      return `await (await tc.page.$(${JSON.stringify(sel)})).waitForDisplayed({ timeout: 10000 })`;
    case 'wait-gone':
      return `await (await tc.page.$(${JSON.stringify(sel)})).waitForDisplayed({ timeout: 10000, reverse: true })`;
    default:
      return `// TODO: unsupported action '${action}'`;
  }
}

function genExpect(exp) {
  const type = String(exp?.type || '').toLowerCase();
  const sel = exp?.selector ? String(exp.selector) : '';
  const text = exp?.text != null ? String(exp.text) : '';
  switch (type) {
    case 'visible':
      return `await (await tc.page.$(${JSON.stringify(sel)})).waitForDisplayed({ timeout: 10000 })`;
    case 'not-visible':
      return `await (await tc.page.$(${JSON.stringify(sel)})).waitForDisplayed({ timeout: 10000, reverse: true })`;
    case 'text-contains':
      return `{
  const el = await tc.page.$(${JSON.stringify(sel)});
  await el.waitForDisplayed({ timeout: 10000 });
  const v = (await el.getText()) ?? '';
  if (!String(v).includes(${JSON.stringify(text)})) throw new Error('expect text to contain: ' + ${JSON.stringify(text)} + ', got: ' + v);
}`;
    default:
      return `// TODO: unsupported expect '${type}'`;
  }
}

function generate(spec) {
  const suite = String(spec?.suite || 'GeneratedSuite');
  const moduleName = spec?.module ? String(spec.module) : 'default';
  const tags = Array.isArray(spec?.tags) ? spec.tags.filter(Boolean).map(String) : [];
  const userDir = spec?.userDir ? String(spec.userDir) : undefined;
  const android = spec?.android && typeof spec.android === 'object' ? spec.android : undefined;
  const keepAppOpen = !!spec?.keepAppOpen;

  const header = [
    `import { describe, it, useTestCase } from 'core-lib'`,
  ].join('\n');

  const tcOptions = {
    module: moduleName,
    tags: tags.length ? tags : undefined,
    userDir,
    android,
    keepAppOpen: keepAppOpen || undefined,
  };
  const tcOptionsLiteral = JSON.stringify(tcOptions, null, 2).replace(/\n/g, '\n').replace(/\\n/g, '\\n');

  const body = [];
  body.push(`describe(${JSON.stringify(suite)}, () => {`);
  body.push(`  const tc = useTestCase(${tcOptionsLiteral});`);
  const cases = Array.isArray(spec?.cases) ? spec.cases : [];
  for (const c of cases) {
    const title = String(c?.title || 'untitled');
    body.push(`  it(${JSON.stringify(title)}, async () => {`);
    const steps = Array.isArray(c?.steps) ? c.steps : [];
    for (const s of steps) body.push('    ' + genStep(s));
    const expects = Array.isArray(c?.expects) ? c.expects : [];
    for (const e of expects) body.push('    ' + genExpect(e));
    body.push('  })');
  }
  body.push('})');

  return [header, '', body.join('\n')].join('\n');
}

function main() {
  const [, , inFile, outFile] = process.argv;
  if (!inFile || !outFile) {
    console.error('Usage: node scripts/generate-test-from-spec.js <spec.json> <output.ts>');
    process.exit(2);
  }
  const inputPath = path.resolve(process.cwd(), inFile);
  const outputPath = path.resolve(process.cwd(), outFile);
  const spec = readJson(inputPath);
  const code = generate(spec);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, code, 'utf-8');
  console.log(`Generated: ${outputPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e?.stack || String(e));
    process.exit(1);
  }
}

