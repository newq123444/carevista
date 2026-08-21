#!/usr/bin/env node
/**
 * Grammar guard.
 *
 * Catches the class of error that breaks the Vercel build but survives a
 * bundler's parse: duplicate object keys (TS1117), duplicate JSX attributes
 * (TS17001), and every other TS1xxx/TS17xxx syntax error.
 *
 * Runs TypeScript with --noResolve so it needs no node_modules for the app's
 * dependencies — only typescript itself. Type errors are NOT checked here
 * (those need real @types); this is a fast pre-flight, not a replacement for
 * `npm run build`.
 *
 *   node scripts/check-grammar.mjs
 *
 * Exit 0 = no grammar errors. Exit 1 = grammar errors found.
 * Exit 2 = the checker could not run (treat as a failure, not a pass).
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TSC_ARGS = ['--noEmit', '--noResolve', '--skipLibCheck',
                  '--jsx', 'react-jsx', '--target', 'ES2020', '--module', 'esnext'];
const GRAMMAR = /error TS(1\d{3}|17\d{3}):/;

// ── Locate a real tsc. Never fall back to `npx tsc`: npx treats "tsc" as a
//    package name, tries to download it, and on failure exits 0 — which would
//    make this checker silently pass. ────────────────────────────────────────
function findTsc() {
  const candidates = [
    join(root, 'frontend/node_modules/typescript/bin/tsc'),
    join(root, 'backend/node_modules/typescript/bin/tsc'),
    join(root, 'node_modules/typescript/bin/tsc'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  try {
    const p = execFileSync('command', ['-v', 'tsc'], { shell: true, encoding: 'utf8' }).trim();
    if (p) return p;
  } catch { /* not on PATH */ }
  return null;
}

const tsc = findTsc();
if (!tsc) {
  console.error('Could not find typescript. Run `npm install` in frontend/ or backend/ first.');
  process.exit(2);
}

function runTsc(files) {
  try {
    execFileSync(process.execPath, [tsc, ...TSC_ARGS, ...files],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    return '';
  } catch (err) {
    if (err.code === 'ENOENT') { console.error('Could not execute tsc at ' + tsc); process.exit(2); }
    return `${err.stdout || ''}${err.stderr || ''}`;
  }
}

// ── Self-test: prove the checker actually detects a known-bad file before we
//    let it report anything as clean. ─────────────────────────────────────────
const probeDir = mkdtempSync(join(tmpdir(), 'grammar-probe-'));
const probe = join(probeDir, 'probe.tsx');
writeFileSync(probe, 'export const x = { a: 1, a: 2 };\n');
const probeOut = runTsc([probe]);
rmSync(probeDir, { recursive: true, force: true });
if (!GRAMMAR.test(probeOut)) {
  console.error('Self-test failed: the checker did not flag a deliberately broken file.');
  console.error('It is not working, so its result cannot be trusted. tsc used: ' + tsc);
  if (probeOut.trim()) console.error(probeOut.trim().split('\n').slice(0, 5).join('\n'));
  process.exit(2);
}

// ── Real run ────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const files = [...walk(join(root, 'frontend/src')), ...walk(join(root, 'backend/src'))];
if (!files.length) {
  console.error('No source files found. Run this from the repository root.');
  process.exit(2);
}

const grammar = runTsc(files).split('\n').filter(l => GRAMMAR.test(l));

console.log(`Checked ${files.length} source files (self-test passed).`);
if (grammar.length) {
  console.error(`\n${grammar.length} grammar error(s) — these WILL fail the build:\n`);
  for (const line of grammar) console.error('  ' + line.trim());
  console.error('\nUsual causes: a duplicate key in an object literal, a repeated JSX attribute.');
  process.exit(1);
}
console.log('No grammar errors.');
console.log('This does not check types. Run `npm run build` in frontend/ and backend/ before deploying.');
