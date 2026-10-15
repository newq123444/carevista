#!/usr/bin/env node
/**
 * Type-check the backend without node_modules.
 *
 * Render runs `tsc` on deploy; a type error there means the API does not
 * update. The frontend had a guard for this and the backend did not, so a
 * typo in a controller would only be found by a failed deploy. This runs the
 * real TypeScript compiler, in strict mode as backend/tsconfig.json asks, with
 * small stand-ins for the npm packages (scripts/typecheck-stubs-backend) and
 * Node's own types.
 *
 * Exit 0 = clean. 1 = type errors. 2 = could not run.
 */
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stubs = join(root, 'scripts/typecheck-stubs-backend/modules.d.ts');
const globals = (process.env.NODE_PATH || '').split(':').filter(Boolean);

const tsc = [join(root, 'backend/node_modules/typescript/bin/tsc'), join(root, 'frontend/node_modules/typescript/bin/tsc'),
  ...globals.map(d => join(d, 'typescript/bin/tsc'))].find(existsSync);
const nodeTypes = [join(root, 'backend/node_modules/@types'),
  ...globals.flatMap(d => [join(d, '@types'), join(d, 'ts-node/node_modules/@types'), join(d, 'tsx/node_modules/@types')])]
  .find(d => existsSync(join(d, 'node/index.d.ts')));
if (!tsc || !nodeTypes) { console.error(`Could not find ${!tsc ? 'typescript' : '@types/node'}.`); process.exit(2); }

// With real node_modules present, use the real types instead of the stubs.
const real = existsSync(join(root, 'backend/node_modules/@types/express'));

function run(extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'cv-btc-'));
  const cfg = join(dir, 'tsconfig.json');
  const include = [join(root, 'backend/src/**/*'), ...(real ? [] : [stubs]), ...extra];
  writeFileSync(cfg, JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'CommonJS', lib: ['ES2022'], strict: true, esModuleInterop: true,
      skipLibCheck: true, resolveJsonModule: true, noEmit: true,
      typeRoots: [nodeTypes], types: ['node'],
    },
    include,
  }));
  try {
    execFileSync(process.execPath, [tsc, '-p', cfg], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
    return '';
  } catch (e) { return `${e.stdout || ''}${e.stderr || ''}`; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

// Self-test: a deliberate error must be reported.
const probeDir = mkdtempSync(join(tmpdir(), 'cv-btc-probe-'));
const probe = join(probeDir, 'probe.ts');
writeFileSync(probe, `import { Request } from 'express';\nexport const n: number = 'not a number';\nexport const f = (r: Request) => r.user!.no_such_field.trim();\n`);
const selfOut = run([probe]);
rmSync(probeDir, { recursive: true, force: true });
if (!/probe\.ts\(2,14\): error TS2322/.test(selfOut) || !/no_such_field/.test(selfOut)) {
  console.error('check-types-backend self-test failed: a deliberate error was not reported.\n' + selfOut.slice(0, 800));
  process.exit(2);
}

const out = run();
if (out.trim()) {
  console.error(out.split('\n').slice(0, 40).join('\n'));
  console.error(`\nBackend type errors (${out.split('\n').filter(l => /error TS/.test(l)).length}). Render's build would fail.`);
  process.exit(1);
}
console.log(`Backend typecheck clean, strict mode${real ? '' : ', against stand-in package types'} (self-test passed).`);
