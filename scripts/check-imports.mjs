#!/usr/bin/env node
/**
 * Duplicate-binding guard.
 *
 * Catches TS2300 "Duplicate identifier" caused by importing the same name
 * twice in one file. The grammar guard cannot see this — it is a semantic
 * error, not a syntax one — but it breaks `npm run build` and therefore the
 * Vercel deploy, which is exactly the failure mode we keep hitting.
 *
 * Exit 0 = clean. Exit 1 = duplicates found. Exit 2 = could not run.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

// Pull the bound names out of an import statement. Handles default, namespace
// and named (with `as`) forms. Type-only imports are ignored: `import type`
// bindings live in a separate declaration space and do not collide.
function bindings(stmt) {
  if (/^import\s+type\b/.test(stmt)) return [];
  const m = stmt.match(/^import\s+([\s\S]+?)\s+from\s/);
  if (!m) return [];                       // side-effect import
  const names = [];
  let clause = m[1].trim();
  const braced = clause.match(/\{([\s\S]*)\}/);
  if (braced) {
    for (let part of braced[1].split(',')) {
      part = part.trim();
      if (!part || /^type\s/.test(part)) continue;
      const as = part.split(/\s+as\s+/);
      names.push((as[1] || as[0]).trim());
    }
    clause = clause.replace(braced[0], '');
  }
  const ns = clause.match(/\*\s+as\s+(\w+)/);
  if (ns) { names.push(ns[1]); clause = clause.replace(ns[0], ''); }
  for (const d of clause.split(',')) {
    const t = d.trim().replace(/,$/, '');
    if (/^\w+$/.test(t)) names.push(t);
  }
  return names;
}

const files = [...walk(join(root, 'frontend/src')), ...walk(join(root, 'backend/src'))];
if (files.length === 0) { console.error('No source files found.'); process.exit(2); }

// Self-test: prove the extractor works before trusting a clean result.
const probe = bindings("import Default, { a as b, c } from 'x';");
if (!(probe.includes('Default') && probe.includes('b') && probe.includes('c'))) {
  console.error('Self-test failed: import parser is broken. Not reporting a pass.');
  process.exit(2);
}

let bad = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const seen = new Map();
  for (const m of src.matchAll(/^import\s[\s\S]*?(?:;|$)/gm)) {
    for (const n of bindings(m[0])) {
      if (seen.has(n)) {
        console.error(`${f.replace(root + '/', '')}: "${n}" is imported more than once (TS2300)`);
        bad++;
      } else seen.set(n, true);
    }
  }
}
if (bad) { console.error(`\n${bad} duplicate import binding(s). The build will fail.`); process.exit(1); }
console.log(`Checked ${files.length} files. No duplicate import bindings.`);
