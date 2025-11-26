/* eslint-disable no-console */
// Generate CORE_BE_ENDPOINTS in apps/api/src/api-tests/corebe.schema.ts
// by scanning ../core-be/server/api/**/*.js for Express route registrations.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORE_BE_ROOT = path.resolve(ROOT, '..', 'core-be');
const CORE_BE_API_DIR = path.join(CORE_BE_ROOT, 'server', 'api');
const SCHEMA_PATH = path.join(
  ROOT,
  'apps',
  'api',
  'src',
  'api-tests',
  'corebe.schema.ts',
);

/**
 * Recursively collect .js files under a directory.
 */
function collectJsFiles(dir) {
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
        if (ent.name === 'node_modules') continue;
        stack.push(full);
      } else if (ent.isFile() && full.endsWith('.js')) {
        out.push(full);
      }
    }
  }
  return out;
}

/**
 * Very small heuristic parser: look for app.get('/path', ...) / router.post("/path", ...)
 */
function extractRoutesFromFile(filePath, apiDir) {
  const rel = path.relative(apiDir, filePath).replace(/\\/g, '/');
  const firstSeg = rel.split('/')[0] || 'general';
  const category =
    firstSeg.charAt(0).toUpperCase() + firstSeg.slice(1).toLowerCase();

  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const routes = [];

  // app.get('/path'...) / router.post("/path"...)
  const directCallRe =
    /\b(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*(['"`])([^'"`]+)\2/gi;
  let m;
  while ((m = directCallRe.exec(text)) !== null) {
    const method = m[1].toUpperCase();
    const rawPath = m[3];
    if (!rawPath || rawPath.startsWith('http')) continue;
    const normPath =
      rawPath.startsWith('/') || rawPath.startsWith('*')
        ? rawPath
        : `/${rawPath}`;
    routes.push({ category, method, path: normPath });
  }

  // app['get']('/path'...) / router["post"]('/path'...)
  const bracketCallRe =
    /\b(?:app|router)\[\s*['"](get|post|put|delete|patch)['"]\s*]\s*\(\s*(['"`])([^'"`]+)\2/gi;
  while ((m = bracketCallRe.exec(text)) !== null) {
    const method = m[1].toUpperCase();
    const rawPath = m[3];
    if (!rawPath || rawPath.startsWith('http')) continue;
    const normPath =
      rawPath.startsWith('/') || rawPath.startsWith('*')
        ? rawPath
        : `/${rawPath}`;
    routes.push({ category, method, path: normPath });
  }

  // app.route('/path').get(...).post(...); / router.route(...)
  const routeBlockRe =
    /\b(?:app|router)\.route\s*\(\s*(['"`])([^'"`]+)\1\)([\s\S]*?);/gi;
  while ((m = routeBlockRe.exec(text)) !== null) {
    const basePathRaw = m[2];
    const chain = m[3] || '';
    if (!basePathRaw || basePathRaw.startsWith('http')) continue;
    const basePath =
      basePathRaw.startsWith('/') || basePathRaw.startsWith('*')
        ? basePathRaw
        : `/${basePathRaw}`;
    const methodChainRe = /\.(get|post|put|delete|patch)\s*\(/gi;
    let mm;
    while ((mm = methodChainRe.exec(chain)) !== null) {
      const method = mm[1].toUpperCase();
      routes.push({ category, method, path: basePath });
    }
  }

  return routes;
}

function makeEndpointId(category, method, routePath) {
  const base = `${category}.${method.toLowerCase()}.${routePath}`;
  let s = base.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '_');
  s = s.replace(/^_+|_+$/g, '');
  if (!s) s = 'endpoint';
  return s;
}

function extractPathParams(routePath) {
  const params = [];
  const re = /:([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(routePath)) !== null) {
    params.push(m[1]);
  }
  return params;
}

function generateEndpoints() {
  if (!fs.existsSync(CORE_BE_API_DIR)) {
    console.error(
      `core-be api directory not found: ${CORE_BE_API_DIR}. Is ../core-be present?`,
    );
    process.exitCode = 1;
    return [];
  }

  const files = collectJsFiles(CORE_BE_API_DIR).filter((f) =>
    /Routes/i.test(path.basename(f)),
  );

  if (!files.length) {
    console.warn(`No *Routes*.js files found under ${CORE_BE_API_DIR}`);
  }

  const map = new Map(); // key -> endpoint

  for (const file of files) {
    const routes = extractRoutesFromFile(file, CORE_BE_API_DIR);
    for (const r of routes) {
      const key = `${r.category}::${r.method}::${r.path}`;
      if (map.has(key)) continue;

      const id = makeEndpointId(r.category, r.method, r.path);
      const pathParams = extractPathParams(r.path);

      const params = pathParams.map((name) => ({
        name,
        location: 'path',
        type: 'string',
        required: true,
        description: '',
        defaultValue: '',
        boundaryCases: [],
      }));

      map.set(key, {
        id,
        category: r.category,
        name: `${r.method} ${r.path}`,
        method: r.method,
        path: r.path,
        description: '',
        tags: [],
        params,
      });
    }
  }

  const endpoints = Array.from(map.values()).sort((a, b) => {
    if (a.category === b.category) {
      return a.path.localeCompare(b.path);
    }
    return a.category.localeCompare(b.category);
  });

  console.log(`Discovered ${endpoints.length} endpoints.`);
  return endpoints;
}

function formatEndpoint(ep) {
  const lines = [];
  lines.push('  {');
  lines.push(`    id: '${ep.id}',`);
  lines.push(`    category: '${ep.category}',`);
  lines.push(`    name: '${ep.name.replace(/'/g, "\\'")}',`);
  lines.push(`    method: '${ep.method}',`);
  lines.push(`    path: '${ep.path}',`);
  lines.push('    description: \'\',');
  lines.push('    tags: [],');
  lines.push('    params: [');
  for (const p of ep.params) {
    lines.push('      {');
    lines.push(`        name: '${p.name}',`);
    lines.push(`        location: '${p.location}',`);
    lines.push("        type: 'string',");
    lines.push('        required: true,');
    lines.push('        description: \'\',');
    lines.push('        defaultValue: \'\',');
    lines.push('        boundaryCases: [],');
    lines.push('      },');
  }
  lines.push('    ],');
  lines.push('  },');
  return lines.join('\n');
}

function updateSchemaFile(endpoints) {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`Schema file not found: ${SCHEMA_PATH}`);
    process.exitCode = 1;
    return;
  }

  const content = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const marker = 'export const CORE_BE_ENDPOINTS: CoreBeApiEndpoint[] = [';
  const idx = content.indexOf(marker);
  if (idx === -1) {
    console.error(
      `Cannot find CORE_BE_ENDPOINTS declaration in ${SCHEMA_PATH}`,
    );
    process.exitCode = 1;
    return;
  }

  const rest = content.slice(idx);
  const endIdxInRest = rest.indexOf('];');
  if (endIdxInRest === -1) {
    console.error(`Cannot find closing "];" for CORE_BE_ENDPOINTS in schema.`);
    process.exitCode = 1;
    return;
  }
  const endIdx = idx + endIdxInRest + 2; // include '];'

  const before = content.slice(0, idx);
  const after = content.slice(endIdx);

  const bodyLines = endpoints.map((ep) => formatEndpoint(ep)).join('\n');
  const replacement = `${marker}\n${bodyLines}\n];`;

  const next = `${before}${replacement}${after}`;
  fs.writeFileSync(SCHEMA_PATH, next, 'utf8');
  console.log(`Updated CORE_BE_ENDPOINTS in ${SCHEMA_PATH}`);
}

function main() {
  const endpoints = generateEndpoints();
  if (!endpoints.length) {
    console.warn('No endpoints discovered; schema not updated.');
    return;
  }
  updateSchemaFile(endpoints);
}

if (require.main === module) {
  main();
}
