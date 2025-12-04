/* eslint-disable no-console */
// Normalize docs/test-plan/web/web-ids.csv into a flat CSV:
// - Input:  Page (merged cells), Element ID (multiple IDs in one cell, separated by newlines), Description
// - Output: one row per (page, elementId), header: Page,Element ID,Description

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'test-plan', 'web', 'web-ids.csv');
const DEST = path.join(ROOT, 'docs', 'test-plan', 'web', 'web-ids.normalized.csv');

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

function escapeCsvField(value) {
  const v = String(value ?? '');
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function normalizeWebIds() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source CSV not found: ${SRC}`);
    process.exitCode = 1;
    return;
  }

  const raw = fs.readFileSync(SRC, 'utf8');
  const rows = parseCsvRows(raw);
  if (!rows.length) {
    console.warn('web-ids.csv is empty, nothing to do.');
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
  const idxDescription = findIndex([
    'description',
    'desc',
    '描述',
    '说明',
    '备注',
  ]);

  if (idxPageName < 0 || idxElementIds < 0) {
    console.error(
      'Cannot find required columns "Page" and "Element ID" in header row.',
    );
    process.exitCode = 1;
    return;
  }

  const outLines = [];
  outLines.push(
    ['Page', 'Element ID', 'Description'].map(escapeCsvField).join(','),
  );

  let lastPageName = null;
  let createdRows = 0;
  let skippedDuplicates = 0;
  const seen = new Set(); // key = `${pageName}::${id}`

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
    const descRaw =
      idxDescription >= 0 ? String(cols[idxDescription] || '').trim() : '';
    const ids = splitElementIds(elementIdsRaw);
    if (!ids.length) continue;

    for (const id of ids) {
      const key = `${pageName}::${id}`;
      if (seen.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      seen.add(key);

      const line = [
        escapeCsvField(pageName),
        escapeCsvField(id),
        escapeCsvField(descRaw),
      ].join(',');
      outLines.push(line);
      createdRows += 1;
    }
  }

  fs.writeFileSync(DEST, outLines.join('\n'), 'utf8');
  console.log(
    `Normalized web-ids: ${createdRows} unique rows written to ${path.relative(
      ROOT,
      DEST,
    )}` +
      (skippedDuplicates
        ? ` (skipped ${skippedDuplicates} duplicate Page+Element ID rows)`
        : ''),
  );
}

normalizeWebIds();
