// src/utils/xlsx.ts
//
// A minimal .xlsx reader, with no dependencies.
//
// Managers keep their rota and their staff list in Excel. Telling them to
// "save as CSV first" is the kind of small friction that stops a pilot before
// it starts, so the app reads the file they actually have.
//
// An .xlsx is a ZIP containing XML. We need three things from it: the shared
// string table, the first worksheet, and the cell values. That is a couple of
// hundred lines — far less risk than adding a dependency we cannot verify.
//
// Deliberately limited: first worksheet only, values only (no formulas, no
// formatting, no dates as serial numbers beyond the common case). If a file
// defeats it, the caller falls back to asking for CSV.

import zlib from 'node:zlib';

// ── Minimal ZIP reader ──────────────────────────────────────────────────────
type ZipEntry = { name: string; data: Buffer };

function readZip(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  // Find the end-of-central-directory record, scanning back from the end.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid .xlsx file (no ZIP directory found)');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method    = buf.readUInt16LE(p + 10);
    const compSize  = buf.readUInt32LE(p + 20);
    const nameLen   = buf.readUInt16LE(p + 28);
    const extraLen  = buf.readUInt16LE(p + 30);
    const commLen   = buf.readUInt16LE(p + 32);
    const localOff  = buf.readUInt32LE(p + 42);
    const name      = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // Jump to the local header to find where the data actually starts.
    const lNameLen  = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start     = localOff + 30 + lNameLen + lExtraLen;
    const raw       = buf.subarray(start, start + compSize);

    let data: Buffer;
    if (method === 0) data = raw;
    else if (method === 8) data = zlib.inflateRawSync(raw);
    else { p += 46 + nameLen + extraLen + commLen; continue; }

    entries.push({ name, data });
    p += 46 + nameLen + extraLen + commLen;
  }
  return entries;
}

// ── XML helpers (the subset a worksheet needs) ──────────────────────────────
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');   // last, so &amp;lt; survives correctly
}

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  // Each <si> may hold one <t> or several inside <r> runs; concatenate them.
  for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) || []) {
    const parts = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
    out.push(parts.map(t => decodeEntities(t.replace(/<[^>]+>/g, ''))).join(''));
  }
  return out;
}

/** "BC12" → { col: 54, row: 12 } (1-based column). */
function parseRef(ref: string) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(m[2]) };
}

/**
 * Read the first worksheet as a grid of strings.
 * Empty cells become '' so every row has the same length.
 */
export function readXlsx(buf: Buffer): string[][] {
  const zip = readZip(buf);
  const get = (n: string) => zip.find(e => e.name === n)?.data.toString('utf8');

  const strings = sharedStrings(get('xl/sharedStrings.xml') || '');

  // Prefer sheet1; otherwise take the first worksheet present.
  const sheetEntry = zip.find(e => e.name === 'xl/worksheets/sheet1.xml')
                  || zip.find(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
  if (!sheetEntry) throw new Error('No worksheet found in the file');
  const sheet = sheetEntry.data.toString('utf8');

  const grid: string[][] = [];
  let maxCol = 0;

  for (const rowXml of sheet.match(/<row[\s\S]*?<\/row>/g) || []) {
    const rowNumMatch = /<row[^>]*\br="(\d+)"/.exec(rowXml);
    const rowIdx = rowNumMatch ? Number(rowNumMatch[1]) - 1 : grid.length;
    const cells: string[] = [];

    for (const cellXml of rowXml.match(/<c[\s\S]*?(?:\/>|<\/c>)/g) || []) {
      const ref  = /\br="([A-Z]+\d+)"/.exec(cellXml)?.[1];
      const type = /\bt="([^"]+)"/.exec(cellXml)?.[1];
      const vRaw = /<v[^>]*>([\s\S]*?)<\/v>/.exec(cellXml)?.[1];
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/.exec(cellXml)?.[1];

      let value = '';
      if (type === 's' && vRaw != null)      value = strings[Number(vRaw)] ?? '';
      else if (type === 'inlineStr')          value = decodeEntities(inline ?? '');
      else if (vRaw != null)                  value = decodeEntities(vRaw);

      const pos = ref ? parseRef(ref) : null;
      const col = pos ? pos.col - 1 : cells.length;
      while (cells.length < col) cells.push('');
      cells[col] = value.trim();
    }
    while (grid.length < rowIdx) grid.push([]);
    grid[rowIdx] = cells;
    if (cells.length > maxCol) maxCol = cells.length;
  }

  // Square it off, and drop trailing blank rows.
  const squared = grid.map(r => { const c = [...r]; while (c.length < maxCol) c.push(''); return c; });
  while (squared.length && squared[squared.length - 1].every(c => c === '')) squared.pop();
  return squared;
}

/** Simple CSV reader, so both formats land in the same shape. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', inQuotes = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuotes) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell.trim()); rows.push(row); }
  while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
  return rows;
}

/** Read whichever the manager actually uploaded. */
export function readSpreadsheet(buf: Buffer, filename: string): string[][] {
  if (/\.xlsx$/i.test(filename)) return readXlsx(buf);
  if (/\.xls$/i.test(filename)) {
    throw new Error('That is an older .xls file. Open it in Excel and use Save As to make a .xlsx or .csv.');
  }
  return readCsv(buf.toString('utf8'));
}
