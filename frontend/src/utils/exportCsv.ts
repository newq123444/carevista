// src/utils/exportCsv.ts
//
// Downloading a register as a spreadsheet. Commissioners and local authorities
// ask for lists; a manager should not have to retype them.

/** Escape a single value for CSV. */
function cell(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  let s = String(v);
  // Dates come back as ISO strings; trim to something a human reads.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) s = s.slice(0, 16).replace('T', ' ');
  // A leading =, +, - or @ is executed as a formula by Excel. Prefix it.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type CsvColumn<T> = { header: string; value: (row: T) => any };

/**
 * Build a CSV and hand it to the browser as a download.
 * The BOM is what makes Excel open UTF-8 correctly — without it, names with
 * accents arrive mangled, which matters in a multilingual workforce.
 */
export function exportCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const head = columns.map(c => cell(c.header)).join(',');
  const body = rows.map(r => columns.map(c => cell(c.value(r))).join(',')).join('\r\n');
  const csv = '﻿' + head + '\r\n' + body;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export a list of plain objects, using their own keys as headers. */
export function exportRows(filename: string, rows: Record<string, any>[], fields?: string[]) {
  if (!rows.length) return;
  const keys = fields?.length ? fields : Object.keys(rows[0]);
  exportCsv(filename, rows, keys.map(k => ({
    header: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: (r: any) => r[k],
  })));
}

export default exportCsv;
