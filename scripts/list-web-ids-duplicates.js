/* eslint-disable no-console */
// List duplicate (Page, Element ID) combinations from docs/test-plan/web/web-ids.csv

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'test-plan', 'web', 'web-ids.csv');

function parseCsvRows(raw) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  const pushCell = () => {
    let v = current;
    v = v.trim();
    v = v.replace(/^"|"$/g, '');
    row.push(v);
    current = '';
  };

  const pushRowIfNotEmpty = () => {
    if (!row.length) return;
    const hasValue = row.some((c) => (c || '').trim().length > 0);
    if (hasValue) {
      rows.push(row.map((c) => (c || '').trim()));
    }
    row = [];
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      pushCell();
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && raw[i + 1] === '\n') {
        i++;
      }
      pushCell();
      pushRowIfNotEmpty();
    } else {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    pushCell();
    pushRowIfNotEmpty();
  }

  return rows;
}

function splitElementIds(raw) {
  const replaced = String(raw || '')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/；/g, ';')
    .replace(/，/g, ',')
    .replace(/、/g, ',');
  const tokens = replaced
    .split(/[,;\n\r\t ]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const looksLikeId = /^[A-Za-z0-9_.:-]+$/;
  return tokens.filter((s) => looksLikeId.test(s));
}

function listDuplicates() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source CSV not found: ${SRC}`);
    process.exitCode = 1;
    return;
  }
  const raw = fs.readFileSync(SRC, 'utf8');
  const rows = parseCsvRows(raw);
  if (!rows.length) {
    console.warn('web-ids.csv is empty.');
    return;
  }

  const header = rows[0] || [];
  const norm = header.map((h) =>
    String(h || '')
      .trim()
      .replace(/[_\s]+/g, '')
      .toLowerCase(),
  );
  const findIndex = (candidates) =>
    norm.findIndex((h) => candidates.includes(h));

  const idxPageName = findIndex(['page', 'pagename', '页面', '页面名称', '页面名']);
  const idxElementIds = findIndex([
    'elementid',
    'element',
    '元素id',
    '元素',
    '元素id号',
    'id',
  ]);

  if (idxPageName < 0 || idxElementIds < 0) {
    console.error(
      'Cannot find required columns "Page" and "Element ID" in header row.',
    );
    process.exitCode = 1;
    return;
  }

  const counts = new Map(); // key -> { page, id, count }
  let lastPageName = null;

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i] || [];
    let pageName = (cols[idxPageName] || '').trim();
    if (!pageName && lastPageName) {
      pageName = lastPageName;
    } else if (pageName) {
      lastPageName = pageName;
    }
    if (!pageName) continue;

    const elementIdsRaw = cols[idxElementIds] || '';
    const ids = splitElementIds(elementIdsRaw);
    if (!ids.length) continue;

    for (const id of ids) {
      const key = `${pageName}::${id}`;
      const cur = counts.get(key) || { page: pageName, id, count: 0 };
      cur.count += 1;
      counts.set(key, cur);
    }
  }

  const dups = Array.from(counts.values()).filter((it) => it.count > 1);
  if (!dups.length) {
    console.log('No duplicate (Page, Element ID) combinations found.');
    return;
  }

  console.log(
    `Found ${dups.length} duplicate (Page, Element ID) combinations:\n`,
  );
  for (const it of dups) {
    console.log(
      `Page="${it.page}", Element ID="${it.id}", occurrences=${it.count}`,
    );
  }
}

listDuplicates();

