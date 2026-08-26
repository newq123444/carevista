#!/usr/bin/env node
/**
 * Icon guard.
 *
 * Two things must stay true for the pictures on the care forms to be worth
 * anything to a carer who reads English as a second language:
 *
 *   1. Every option in a group has a DIFFERENT picture. If two options in the
 *      same list look identical, the picture carries no information at exactly
 *      the moment it is needed — when the carer is choosing between them.
 *   2. Every option has a picture at all.
 *
 * Run: node scripts/check-icons.mjs      Exit 1 if either rule is broken.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const formPath = join(root, 'frontend/src/pages/dashboards/CarerDashboard.tsx');
const iconPath = join(root, 'frontend/src/utils/optionIcons.ts');

for (const p of [formPath, iconPath]) {
  if (!existsSync(p)) { console.error('Cannot find ' + p); process.exit(2); }
}

const form = readFileSync(formPath, 'utf8');
const icons = readFileSync(iconPath, 'utf8');

// ── Build the icon table ────────────────────────────────────────────────────
const table = new Map();
const tableBody = icons.slice(icons.indexOf('const OPTION_ICONS'), icons.indexOf('const KEYWORD_RULES'));
for (const m of tableBody.matchAll(/^\s*'((?:[^'\\]|\\.)*)':\s*'([^']*)',/gm)) {
  table.set(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'), m[2]);
}
if (table.size === 0) { console.error('Could not read the icon table.'); process.exit(2); }

// ── Read the option groups off the form ─────────────────────────────────────
const groups = [];
for (const m of form.matchAll(/label:\s*'([^']*)',\s*\n\s*options:\s*\[([^\]]*)\]/g)) {
  const options = [...m[2].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1].replace(/\\'/g, "'"));
  groups.push({ label: m[1], options });
}
for (const name of ['DRINK_OPTIONS', 'TEXTURE_OPTIONS']) {
  const m = form.match(new RegExp(name + "\\s*=\\s*\\[([^\\]]*)\\]"));
  if (m) groups.push({ label: name, options: [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1]) });
}

const missing = [];
const clashes = [];
let total = 0;

for (const g of groups) {
  const seen = new Map();
  for (const o of g.options) {
    total++;
    const icon = table.get(o);
    if (!icon) { missing.push(`${g.label} → ${o}`); continue; }
    if (seen.has(icon)) clashes.push(`${g.label}: "${seen.get(icon)}" and "${o}" both show ${icon}`);
    else seen.set(icon, o);
  }
}

console.log(`Checked ${total} options across ${groups.length} groups.`);

if (missing.length) {
  console.error(`\n${missing.length} option(s) have no picture:\n`);
  missing.forEach(m => console.error('  ' + m));
}
if (clashes.length) {
  console.error(`\n${clashes.length} group(s) reuse a picture — a carer cannot tell these apart:\n`);
  clashes.forEach(c => console.error('  ' + c));
}
if (missing.length || clashes.length) {
  console.error('\nAdd or change the entry in frontend/src/utils/optionIcons.ts.');
  process.exit(1);
}
console.log('Every option has its own picture.');
