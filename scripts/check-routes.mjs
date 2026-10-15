#!/usr/bin/env node
/**
 * Route correlator.
 *
 * Every `api.get('/x')` in the frontend must have a matching route in the
 * backend, or the button silently 404s in production — which is invisible in a
 * build and invisible in a typecheck.
 *
 * Note the tolerance for whitespace in the pattern below. An earlier version
 * required `router.get('`, and the moment routes were column-aligned as
 * `router.get   ('` it reported ten perfectly good endpoints as missing. A
 * checker that is fooled by formatting trains you to ignore it.
 *
 * Exit 0 = every call has a route. Exit 1 = at least one does not.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const routesFile = join(root, 'backend/src/routes/index.ts');
if (!existsSync(routesFile)) { console.error('Cannot find backend/src/routes/index.ts'); process.exit(2); }

const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);
function walk(dir, out = []) {
  let entries; try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/** `/staff/:id/full` and `/staff/${id}/full` must compare equal. */
const norm = p =>
  p.replace(/\$\{[^}]*\}/g, ':x').replace(/:[A-Za-z_]+\??/g, ':x').replace(/\/+$/, '') || '/';

const routesSrc = readFileSync(routesFile, 'utf8');
const backend = new Set();
// \s* after the method: tolerate column alignment.
for (const m of routesSrc.matchAll(/router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g)) {
  backend.add(`${m[1].toUpperCase()} ${norm(m[2])}`);
}
if (backend.size === 0) { console.error('Parsed zero backend routes — the pattern is wrong.'); process.exit(2); }

const missing = [];
let calls = 0;
for (const f of walk(join(root, 'frontend/src'))) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\bapi\.(get|post|put|patch|delete)(?:<[^>]*>)?\s*\(\s*[`'"]([^`'"]+)/g)) {
    const path = m[2].split('?')[0];
    if (!path.startsWith('/')) continue;
    calls++;
    const key = `${m[1].toUpperCase()} ${norm(path)}`;
    if (!backend.has(key)) missing.push(`${key}  <- ${f.replace(root + '/', '')}`);
  }
}

// Self-test: a call that certainly has no route must be reported.
if (backend.has('GET /definitely-not-a-real-route')) {
  console.error('Self-test failed: the route set is not what it claims.'); process.exit(2);
}

if (missing.length) {
  for (const m of [...new Set(missing)].sort()) console.error('  MISSING ' + m);
  console.error(`\n${new Set(missing).size} frontend call(s) have no backend route.`);
  process.exit(1);
}
console.log(`${calls} frontend calls, ${backend.size} backend routes. Every call has a route.`);
