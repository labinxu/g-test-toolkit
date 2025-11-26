/* eslint-disable no-console */
// Generate NOTIF_ENDPOINTS in apps/api/src/api-tests/notif.schema.ts
// by scanning ../notif/app/api/**/*.py for FastAPI routes.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOTIF_ROOT = path.resolve(ROOT, '..', 'notif');
const NOTIF_API_DIR = path.join(NOTIF_ROOT, 'app', 'api');
const NOTIF_SERVICES_DIR = path.join(NOTIF_ROOT, 'app', 'services');
const SCHEMA_PATH = path.join(
  ROOT,
  'apps',
  'api',
  'src',
  'api-tests',
  'notif.schema.ts',
);

function collectPyFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === '__pycache__') continue;
        stack.push(full);
      } else if (ent.isFile() && full.endsWith('.py') && ent.name !== '__init__.py') {
        out.push(full);
      }
    }
  }
  return out;
}

function deriveCategoryFromFile(filePath, apiDir) {
  // e.g. ../notif/app/api/notify.py -> Notify
  const rel = path.relative(apiDir, filePath).replace(/\\/g, '/');
  const noExt = rel.replace(/\.py$/, '');
  const parts = noExt.split('/');
  const base = (parts[parts.length - 1] || 'notif').toLowerCase();
  if (!base) return 'Notif';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function normalizePath(p) {
  if (!p) return '/';
  return p.startsWith('/') ? p : `/${p}`;
}

function makeEndpointId(category, method, routePath) {
  const base = `${category}.${method.toLowerCase()}.${routePath}`;
  let s = base.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '_');
  s = s.replace(/^_+|_+$/g, '');
  return s || 'endpoint';
}

function extractRoutesFromFile(filePath, apiDir, modelNamesSet) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const category = deriveCategoryFromFile(filePath, apiDir);
  const routes = [];

  // Match decorators like: @router.get('/path'...) / @router.post("/path"...)
  const decRe =
    /@router\.(get|post|put|delete|patch)\s*\(\s*(['"])([^'"]+)\2/gi;
  let m;
  while ((m = decRe.exec(text)) !== null) {
    const method = m[1].toUpperCase();
    const rawPath = m[3];
    if (!rawPath) continue;
    const pathNorm = normalizePath(rawPath);
    let bodyModelName = null;
    let summary = null;
    let desc = null;

    // Try to capture summary / description from decorator args
    try {
      const decStart = m.index;
      const afterDec = text.slice(decStart);
      const parenIdx = afterDec.indexOf('(');
      if (parenIdx >= 0) {
        let depth = 0;
        let endIdx = -1;
        for (let i = parenIdx; i < afterDec.length; i++) {
          const ch = afterDec[i];
          if (ch === '(') depth += 1;
          else if (ch === ')') {
            depth -= 1;
            if (depth === 0) {
              endIdx = i;
              break;
            }
          }
        }
        if (endIdx > parenIdx) {
          const argsBlock = afterDec.slice(parenIdx + 1, endIdx);
          const summaryMatch = argsBlock.match(
            /summary\s*=\s*(['"])([\s\S]*?)\1/,
          );
          if (summaryMatch) {
            summary = summaryMatch[2].trim();
          }
          const descMatch = argsBlock.match(
            /description\s*=\s*(['"])([\s\S]*?)\1/,
          );
          if (descMatch) {
            desc = descMatch[2].trim();
          }
        }
      }
    } catch {
      // ignore summary/description extraction errors
    }

    if (modelNamesSet && modelNamesSet.size > 0) {
      const after = text.slice(decRe.lastIndex);
      const funcMatch = after.match(
        /async\s+def\s+[A-Za-z_][A-Za-z0-9_]*\s*\(([^)]*)\)\s*:/,
      );
      if (funcMatch) {
        const paramsSig = funcMatch[1] || '';
        const paramTypeRe =
          /[A-Za-z_][A-Za-z0-9_]*\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/g;
        let pm;
        // eslint-disable-next-line no-cond-assign
        while ((pm = paramTypeRe.exec(paramsSig)) !== null) {
          const typeName = pm[1];
          if (modelNamesSet.has(typeName)) {
            bodyModelName = typeName;
            break;
          }
        }
      }
    }

    routes.push({ category, method, path: pathNorm, bodyModelName, summary, description: desc });
  }

  return routes;
}

function inferFieldType(typeExpr) {
  const raw = (typeExpr || '').trim();
  const t = raw.replace(/\s+/g, '');
  const lower = t.toLowerCase();
  if (
    lower.includes('int') ||
    lower.includes('float') ||
    lower.includes('decimal')
  ) {
    return 'number';
  }
  if (lower.includes('bool')) {
    return 'boolean';
  }
  if (
    lower.includes('list[') ||
    lower.startsWith('list') ||
    lower.includes('dict') ||
    lower.includes('mapping')
  ) {
    return 'json';
  }
  return 'string';
}

function isFieldRequired(typeExpr, defaultExpr) {
  const hasDefault = defaultExpr != null && String(defaultExpr).trim() !== '';
  if (hasDefault) return false;
  const raw = (typeExpr || '').toLowerCase();
  if (raw.includes('none') || raw.includes('optional')) return false;
  return true;
}

function parseDefault(defaultExpr) {
  if (defaultExpr == null) return undefined;
  const raw = String(defaultExpr).trim();
  if (!raw) return undefined;
  if (/^(True|False)$/i.test(raw)) {
    return /^True$/i.test(raw);
  }
  if (/^[+-]?\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  if (/^[+-]?\d+\.\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    return raw.slice(1, -1);
  }
  return undefined;
}

function makeBoundaryCases(fieldName, fieldType) {
  const cases = [];
  if (fieldType === 'string') {
    cases.push({
      id: `${fieldName}.empty`,
      label: '空字符串',
      kind: 'empty',
      value: '',
      description: '空字符串',
      enabled: true,
    });
    cases.push({
      id: `${fieldName}.long`,
      label: '超长字符串',
      kind: 'max',
      value: 'x'.repeat(256),
      description: '超长字符串（256）',
      enabled: true,
    });
    cases.push({
      id: `${fieldName}.special`,
      label: '特殊字符',
      kind: 'special',
      value: '特殊字符!@#',
      description: '包含特殊字符',
      enabled: true,
    });
  } else if (fieldType === 'number') {
    cases.push({
      id: `${fieldName}.zero`,
      label: '0',
      kind: 'zero',
      value: 0,
      description: '0 值',
      enabled: true,
    });
    cases.push({
      id: `${fieldName}.negative`,
      label: '负数',
      kind: 'negative',
      value: -1,
      description: '负数',
      enabled: true,
    });
    cases.push({
      id: `${fieldName}.large`,
      label: '大数',
      kind: 'large',
      value: 1000000,
      description: '较大数值',
      enabled: true,
    });
  } else if (fieldType === 'boolean') {
    cases.push({
      id: `${fieldName}.true`,
      label: 'true',
      kind: 'true',
      value: true,
      description: '布尔 true',
      enabled: true,
    });
    cases.push({
      id: `${fieldName}.false`,
      label: 'false',
      kind: 'false',
      value: false,
      description: '布尔 false',
      enabled: true,
    });
  }
  return cases;
}

function loadPydanticModels() {
  const models = {};
  if (!fs.existsSync(NOTIF_SERVICES_DIR)) {
    return models;
  }
  const serviceFiles = [];
  const stack = [NOTIF_SERVICES_DIR];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === '__pycache__') continue;
        stack.push(full);
      } else if (ent.isFile() && full.endsWith('.py')) {
        serviceFiles.push(full);
      }
    }
  }

  const classRe =
    /^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*BaseModel\s*\)\s*:/;
  const fieldRe =
    /^\s{4,}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=#:]+?)(?:=\s*([^#]+))?\s*$/;

  for (const file of serviceFiles) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    let currentModel = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const mClass = line.match(classRe);
      if (mClass) {
        currentModel = mClass[1];
        if (!models[currentModel]) {
          models[currentModel] = { fields: [] };
        }
        continue;
      }

      if (!currentModel) continue;

      // Stop if we hit another top-level class or def
      if (/^class\s+/.test(line) || /^def\s+/.test(line)) {
        currentModel = null;
        continue;
      }

      const mField = line.match(fieldRe);
      if (mField) {
        const name = mField[1];
        const typeExpr = mField[2].trim();
        const defaultExpr =
          typeof mField[3] === 'string' ? mField[3].trim() : undefined;
        // Skip config or non-data attributes
        if (name === 'model_config') continue;
        models[currentModel].fields.push({
          name,
          typeExpr,
          defaultExpr,
        });
      }
    }
  }

  return models;
}

function buildParamsFromModel(modelInfo) {
  const params = [];
  if (!modelInfo || !Array.isArray(modelInfo.fields)) return params;
  for (const field of modelInfo.fields) {
    const fieldType = inferFieldType(field.typeExpr);
    const required = isFieldRequired(field.typeExpr, field.defaultExpr);
    const defVal = parseDefault(field.defaultExpr);
    const boundaryCases = makeBoundaryCases(field.name, fieldType);
    params.push({
      name: field.name,
      location: 'body',
      type: fieldType === 'json' ? 'json' : fieldType,
      required,
      description: '',
      defaultValue: defVal,
      boundaryCases,
    });
  }
  return params;
}

function generateEndpoints() {
  if (!fs.existsSync(NOTIF_API_DIR)) {
    console.error(
      `[notif-scan] api directory not found: ${NOTIF_API_DIR}. Is ../notif present?`,
    );
    return [];
  }

  const files = collectPyFiles(NOTIF_API_DIR);
  if (!files.length) {
    console.warn(`[notif-scan] no api files found under ${NOTIF_API_DIR}`);
  }

  const models = loadPydanticModels();
  const modelNames = new Set(Object.keys(models));

  const seen = new Set();
  const endpoints = [];

  for (const file of files) {
    const routes = extractRoutesFromFile(file, NOTIF_API_DIR, modelNames);
    for (const r of routes) {
      const key = `${r.category}::${r.method}::${r.path}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const id = makeEndpointId(r.category, r.method, r.path);
      const modelInfo =
        r.bodyModelName && models[r.bodyModelName]
          ? models[r.bodyModelName]
          : null;
      const params = buildParamsFromModel(modelInfo);
      const description =
        (r.description && String(r.description).trim()) ||
        (r.summary && String(r.summary).trim()) ||
        '';
      endpoints.push({
        id,
        category: r.category,
        name: `${r.method} ${r.path}`,
        method: r.method,
        path: r.path,
        description,
        params,
      });
    }
  }

  endpoints.sort((a, b) => {
    if (a.category === b.category) {
      if (a.path === b.path) return a.method.localeCompare(b.method);
      return a.path.localeCompare(b.path);
    }
    return a.category.localeCompare(b.category);
  });

  console.log(`[notif-scan] discovered ${endpoints.length} endpoints`);
  return endpoints;
}

function formatEndpoint(ep) {
  const safeName = String(ep.name).replace(/'/g, "\\'");
  const safePath = String(ep.path).replace(/'/g, "\\'");
  const safeDesc = String(ep.description || '').replace(/'/g, "\\'").replace(/\s+/g, ' ').trim();
  const lines = [];
  lines.push('  {');
  lines.push(`    id: '${ep.id}',`);
  lines.push(`    category: '${ep.category}',`);
  lines.push(`    name: '${safeName}',`);
  lines.push(`    method: '${ep.method}',`);
  lines.push(`    path: '${safePath}',`);
  lines.push(`    description: '${safeDesc}',`);
  lines.push('    tags: [],');
  if (Array.isArray(ep.params) && ep.params.length > 0) {
    lines.push('    params: [');
    for (const p of ep.params) {
      const safeDesc = String(p.description || '').replace(/'/g, "\\'");
      lines.push('      {');
      lines.push(`        name: '${p.name}',`);
      lines.push(`        location: '${p.location}',`);
      lines.push(`        type: '${p.type}',`);
      lines.push(`        required: ${p.required ? 'true' : 'false'},`);
      lines.push(`        description: '${safeDesc}',`);
      if (p.defaultValue === undefined) {
        lines.push('        defaultValue: undefined,');
      } else if (typeof p.defaultValue === 'string') {
        const safeDef = p.defaultValue.replace(/'/g, "\\'");
        lines.push(`        defaultValue: '${safeDef}',`);
      } else {
        lines.push(`        defaultValue: ${JSON.stringify(p.defaultValue)},`);
      }
      if (Array.isArray(p.boundaryCases) && p.boundaryCases.length > 0) {
        lines.push('        boundaryCases: [');
        for (const b of p.boundaryCases) {
          const safeLabel = String(b.label).replace(/'/g, "\\'");
          const safeKind = String(b.kind).replace(/'/g, "\\'");
          const safeBDesc = String(b.description || '').replace(/'/g, "\\'");
          lines.push('          {');
          lines.push(`            id: '${b.id}',`);
          lines.push(`            label: '${safeLabel}',`);
          lines.push(`            kind: '${safeKind}',`);
          lines.push(
            `            value: ${JSON.stringify(b.value)},`,
          );
          lines.push(`            description: '${safeBDesc}',`);
          lines.push(
            `            enabled: ${b.enabled ? 'true' : 'false'},`,
          );
          lines.push('          },');
        }
        lines.push('        ],');
      } else {
        lines.push('        boundaryCases: [],');
      }
      lines.push('      },');
    }
    lines.push('    ],');
  } else {
    lines.push('    params: [],');
  }
  lines.push('  },');
  return lines.join('\n');
}

function updateSchemaFile(endpoints) {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`[notif-scan] schema file not found: ${SCHEMA_PATH}`);
    return;
  }

  const content = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const marker = 'export const NOTIF_ENDPOINTS: ApiEndpoint[] = [';
  const idx = content.indexOf(marker);
  if (idx === -1) {
    console.error(
      `[notif-scan] cannot find NOTIF_ENDPOINTS declaration in ${SCHEMA_PATH}`,
    );
    return;
  }

  const rest = content.slice(idx);
  const endIdxInRest = rest.indexOf('];');
  if (endIdxInRest === -1) {
    console.error('[notif-scan] cannot find closing "];" for NOTIF_ENDPOINTS');
    return;
  }
  const endIdx = idx + endIdxInRest + 2;

  const before = content.slice(0, idx);
  const after = content.slice(endIdx);

  const bodyLines = endpoints.map((ep) => formatEndpoint(ep)).join('\n');
  const replacement = `${marker}\n${bodyLines}\n];`;

  const next = `${before}${replacement}${after}`;
  fs.writeFileSync(SCHEMA_PATH, next, 'utf8');
  console.log(`[notif-scan] updated NOTIF_ENDPOINTS in ${SCHEMA_PATH}`);
}

function main() {
  const endpoints = generateEndpoints();
  if (!endpoints.length) {
    console.warn('[notif-scan] no endpoints discovered; schema not updated');
    return;
  }
  updateSchemaFile(endpoints);
}

if (require.main === module) {
  main();
}
