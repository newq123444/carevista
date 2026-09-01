#!/usr/bin/env node
/**
 * Dependency guard.
 *
 * Catches TS2307 "Cannot find module 'x'" — importing a package that is not in
 * package.json. This is what broke the last build: a file imported
 * 'react-hot-toast', which the project does not use.
 *
 * It also refuses to let the typecheck stubs declare a module that is not a
 * real dependency. That is not a hypothetical: the stub file declared
 * 'react-hot-toast', so the offline typechecker resolved the import happily and
 * reported a clean run on code that could not build. A stub for a package you
 * do not depend on does not paper over a crack — it paints over one.
 *
 * Exit 0 = clean. Exit 1 = problems. Exit 2 = could not run.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

// Node builtins are always importable and never appear in package.json.
const BUILTIN = new Set(['fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util',
  'stream', 'zlib', 'events', 'buffer', 'child_process', 'assert', 'net', 'tls', 'dns',
  'querystring', 'readline', 'worker_threads', 'perf_hooks', 'timers', 'string_decoder',
  'process', 'cluster', 'v8', 'vm', 'tty', 'constants', 'module', 'punycode']);

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

// "@scope/pkg/sub" -> "@scope/pkg"; "pkg/sub" -> "pkg"
function packageOf(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function declared(pkgJsonPath) {
  if (!existsSync(pkgJsonPath)) return null;
  const d = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  return new Set([
    ...Object.keys(d.dependencies || {}),
    ...Object.keys(d.devDependencies || {}),
    ...Object.keys(d.peerDependencies || {}),
    ...Object.keys(d.optionalDependencies || {}),
  ]);
}

const IMPORT_RE = /(?:^|\n)\s*import\s(?:[\s\S]*?\sfrom\s)?['"]([^'"]+)['"]/g;
const REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

let problems = 0;

for (const area of ['frontend', 'backend']) {
  const dir = join(root, area);
  const deps = declared(join(dir, 'package.json'));
  if (!deps) continue;
  for (const f of walk(join(dir, 'src'))) {
    const text = readFileSync(f, 'utf8');
    const specs = new Set();
    for (const re of [IMPORT_RE, REQUIRE_RE, DYNAMIC_RE]) {
      re.lastIndex = 0;
      let m; while ((m = re.exec(text))) specs.add(m[1]);
    }
    for (const spec of specs) {
      if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/')) continue;
      const bare = spec.startsWith('node:') ? spec.slice(5) : spec;
      const pkg = packageOf(bare);
      if (BUILTIN.has(pkg)) continue;
      // Subpaths of a declared package are fine (react/jsx-runtime, date-fns/locale).
      if (deps.has(pkg)) continue;
      console.error(`${f.replace(root + '/', '')}: imports "${spec}", which is not in ${area}/package.json (TS2307)`);
      problems++;
    }
  }
}

// The stubs must not invent packages the project does not have.
const stubFile = join(root, 'scripts/typecheck-stubs/deps.d.ts');
if (existsSync(stubFile)) {
  const feDeps = declared(join(root, 'frontend/package.json')) || new Set();
  const beDeps = declared(join(root, 'backend/package.json')) || new Set();
  const text = readFileSync(stubFile, 'utf8');
  for (const m of text.matchAll(/declare\s+module\s+['"]([^'"]+)['"]/g)) {
    const pkg = packageOf(m[1]);
    if (BUILTIN.has(pkg) || pkg.startsWith('*') || m[1].startsWith('*')) continue;
    if (!feDeps.has(pkg) && !beDeps.has(pkg)) {
      console.error(`scripts/typecheck-stubs/deps.d.ts: stubs "${m[1]}", which is not a dependency of ` +
                    `either package.json. A stub for a package you do not have makes the typechecker ` +
                    `report a pass on code that cannot build. Remove it.`);
      problems++;
    }
  }
}

if (problems) { console.error(`\n${problems} dependency problem(s). The build will fail.`); process.exit(1); }
console.log('Every imported package is declared, and no stub invents one.');
