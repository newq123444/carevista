#!/usr/bin/env node
/**
 * Note-type guard.
 *
 * care_notes.note_type is a Postgres enum. Sending a value that is not in it
 * fails the INSERT, so the carer gets a server error and the care goes
 * unrecorded. Nothing catches this at build time: it is a valid string, it
 * type-checks, and it only fails against a real database.
 *
 * It had been shipping for months — continence care, wounds, falls, activities,
 * end of life and handover notes were all unrecordable from the carer screen.
 *
 * Exit 0 = every note type the frontend can send exists. Exit 1 = one does not.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = join(root, 'backend/migrations');
if (!existsSync(migrations)) { console.error('No migrations directory.'); process.exit(2); }

// The enum as it stands after every migration has run.
let sql = '';
for (const f of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
  sql += readFileSync(join(migrations, f), 'utf8') + '\n';
}

const created = /CREATE TYPE note_type AS ENUM\s*\(([\s\S]*?)\)/.exec(sql);
if (!created) { console.error('Could not find the note_type enum.'); process.exit(2); }

const allowed = new Set([...created[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]));
for (const m of sql.matchAll(/ALTER TYPE note_type ADD VALUE(?: IF NOT EXISTS)? '([a-z_]+)'/g)) {
  allowed.add(m[1]);
}
if (allowed.size < 5) { console.error('Parsed too few enum values — the parser is wrong.'); process.exit(2); }

const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

let problems = 0, checked = 0;
for (const f of walk(join(root, 'frontend/src'))) {
  const text = readFileSync(f, 'utf8');
  // `noteType: 'x'` anywhere in a payload, plus `value: 'x'` but ONLY inside the
  // NOTE_TYPES array itself. Scanning the whole file for `value:` swept up meal
  // times and appetite options and reported twelve things that were never note
  // types — a checker that cries wolf gets ignored, so it has to be precise.
  const candidates = [...text.matchAll(/\bnoteType:\s*'([a-z_]+)'/g)];

  const start = text.search(/\bNOTE_TYPES\s*(?::[^=]*)?=\s*\[/);
  if (start !== -1) {
    const from = text.indexOf('[', start);
    let depth = 0, end = from;
    for (let i = from; i < text.length; i++) {
      if (text[i] === '[') depth++;
      else if (text[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
    }
    const block = text.slice(from, end + 1);
    for (const m of block.matchAll(/\{\s*value:\s*'([a-z_]+)'/g)) {
      candidates.push({ 0: m[0], 1: m[1], index: from + m.index });
    }
  }
  for (const m of candidates) {
    checked++;
    if (!allowed.has(m[1])) {
      const line = text.slice(0, m.index).split('\n').length;
      console.error(`${f.replace(root + '/', '')}:${line}  note type '${m[1]}' is not in the ` +
                    `note_type enum. Saving it will fail against the database.`);
      problems++;
    }
  }
}

if (problems) {
  console.error(`\nEnum allows: ${[...allowed].sort().join(', ')}`);
  console.error(`${problems} unusable note type(s). Add them in a migration.`);
  process.exit(1);
}
console.log(`Checked ${checked} note types against ${allowed.size} the database accepts.`);
