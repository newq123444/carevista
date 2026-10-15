#!/usr/bin/env node
/**
 * Every local file imported for its default export must have one.
 *
 * v87 shipped a ResidentDetail.tsx whose main component had been cut off by a
 * bad edit. The type check could not see it — React.lazy(() => import(...)) is
 * `any` against the stubbed types — and the first sign would have been a
 * failed Vercel build. This catches it in a second, without node_modules:
 *   • lazy(() => import('./pages/X'))  → X must `export default`
 *   • import X from './local/file'      → file must `export default`
 * Exit 0 = all present. 1 = missing.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'frontend/src');
function* walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) yield* walk(p); else if (/\.(tsx?|jsx?)$/.test(f)) yield p; } }
const resolveFile = (from, spec) => {
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, join(base, 'index.tsx'), join(base, 'index.ts')]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
};
const hasDefault = t => /export\s+default\b/.test(t) || /export\s*\{[^}]*\bdefault\b[^}]*\}/.test(t) || /export\s*\{[^}]*\bas\s+default\b/.test(t);

let bad = 0, checked = 0;
for (const f of walk(src)) {
  const text = readFileSync(f, 'utf8');
  const specs = [
    ...[...text.matchAll(/lazy\(\s*\(\)\s*=>\s*import\(\s*['"](\.[^'"]+)['"]\s*\)/g)].map(m => m[1]),
    ...[...text.matchAll(/^import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s+from\s+['"](\.[^'"]+)['"]/gm)].map(m => m[2]),
  ];
  for (const s of specs) {
    if (/\.(css|svg|png|json)$/.test(s)) continue;
    const target = resolveFile(f, s);
    if (!target) continue; // check-imports reports missing files
    checked++;
    if (!hasDefault(readFileSync(target, 'utf8'))) {
      console.error(`${f.replace(root + '/', '')} imports the default export of ${target.replace(root + '/', '')}, which has none.`);
      bad++;
    }
  }
}
if (bad) process.exit(1);
console.log(`Checked ${checked} default imports: every one exists.`);
