#!/usr/bin/env node
/**
 * Offline typecheck.
 *
 * `npm run build` runs `tsc` against the real @types packages. When those
 * cannot be installed — an offline machine, a blocked registry, a CI job that
 * has not run `npm install` yet — there is normally no way to typecheck at all,
 * and the errors only surface on the deploy. That is how the last three builds
 * broke.
 *
 * This runs the real TypeScript compiler against hand-written stand-ins for the
 * dependencies (scripts/typecheck-stubs). Those stubs deliberately leave React
 * internals as `any`; what gets checked is OUR code against OUR interfaces:
 * misspelled properties, wrong argument counts, values of the wrong type,
 * and style objects that have widened to `string`.
 *
 * It is a safety net, NOT a replacement for `npm run build`. Anything the stubs
 * type as `any` is unchecked, so a clean run here does not promise a clean
 * Vercel build. It promises only that a specific, common family of errors is
 * absent.
 *
 * Exit 0 = clean. Exit 1 = errors. Exit 2 = could not run (treat as failure).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stubs = join(root, 'scripts/typecheck-stubs');
const src = join(root, 'frontend/src');

function findTsc() {
  for (const c of [
    join(root, 'frontend/node_modules/typescript/bin/tsc'),
    join(root, 'backend/node_modules/typescript/bin/tsc'),
    join(root, 'node_modules/typescript/bin/tsc'),
  ]) if (existsSync(c)) return c;
  try {
    const p = execFileSync('command', ['-v', 'tsc'], { shell: true, encoding: 'utf8' }).trim();
    if (p) return p;
  } catch { /* not on PATH */ }
  try {
    const g = join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript/bin/tsc');
    if (existsSync(g)) return g;
  } catch { /* no npm */ }
  for (const d of (process.env.NODE_PATH || '').split(':').filter(Boolean)) {
    const g = join(d, 'typescript/bin/tsc');
    if (existsSync(g)) return g;
  }
  return null;
}

const tsc = findTsc();
if (!tsc) { console.error('Could not find typescript.'); process.exit(2); }
if (!existsSync(stubs)) { console.error('Missing ' + stubs); process.exit(2); }

const OPTS = {
  target: 'ES2020', lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext',
  skipLibCheck: true, moduleResolution: 'bundler', allowImportingTsExtensions: true,
  resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: 'react-jsx',
  strict: false, noUnusedLocals: false, noUnusedParameters: false, types: [],
};

function run(include) {
  const dir = mkdtempSync(join(tmpdir(), 'cv-tc-'));
  const cfg = join(dir, 'tsconfig.json');
  writeFileSync(cfg, JSON.stringify({ compilerOptions: OPTS, include }, null, 2));
  let out = '';
  try {
    execFileSync(process.execPath, [tsc, '-p', cfg],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    if (err.code === 'ENOENT') { rmSync(dir, { recursive: true, force: true }); console.error('Could not execute tsc'); process.exit(2); }
    out = `${err.stdout || ''}${err.stderr || ''}`;
  }
  rmSync(dir, { recursive: true, force: true });
  return out;
}

// ── Self-test: prove the checker still detects errors it is supposed to catch.
//    A checker that has quietly stopped checking is worse than no checker,
//    because it reports a pass. ─────────────────────────────────────────────
const probeDir = mkdtempSync(join(tmpdir(), 'cv-tc-probe-'));
mkdirSync(join(probeDir, 'p'), { recursive: true });
writeFileSync(join(probeDir, 'p/probe.tsx'), `
interface Thing { name: string }
export function P({ t }: { t: Thing }) {
  const widened = { flexWrap: 'wrap' };
  const n: number = t.name;
  t.nope();
  return <div style={widened}>{n}</div>;
}
`);
const probeOut = run([join(stubs, '**/*.d.ts'), join(probeDir, '**/*')]);
rmSync(probeDir, { recursive: true, force: true });
const wanted = ['TS2322', 'TS2339'];
const missing = wanted.filter(code => !probeOut.includes(code));
if (missing.length) {
  console.error('Self-test failed — the typechecker did not flag ' + missing.join(', ') + '.');
  console.error('Not reporting a pass. Fix scripts/typecheck-stubs before trusting this.');
  process.exit(2);
}

const out = run([join(stubs, '**/*.d.ts'), join(src, '**/*')]);
const errors = out.split('\n').filter(l => /error TS\d+:/.test(l));
if (errors.length) {
  console.error(out.trim());
  console.error(`\n${errors.length} type error(s). The Vercel build will fail.`);
  process.exit(1);
}
console.log('Typecheck clean against stubbed dependencies (self-test passed).');
console.log('Stubs leave React internals as `any`, so this is a net, not a guarantee.');
console.log('Still run `npm run build` with real node_modules before deploying.');
