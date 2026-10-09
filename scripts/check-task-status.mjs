#!/usr/bin/env node
/**
 * Task-status guard.
 *
 * GET /tasks does not return the value stored in care_tasks.status. It throws
 * that away and recomputes one from the clock. A screen that filters for
 * 'pending' therefore matches nothing, silently, for ever — which is exactly
 * the bug that made the new care deck announce "that is everything" on a shift
 * where nothing had been done.
 *
 * Nothing else catches it: it compiles, it type-checks, and it fails only as
 * an empty list that looks like a legitimately empty list.
 *
 * So: every task status the frontend compares against must be one the backend
 * can actually emit.
 *
 * Exit 0 = clean. Exit 1 = a status that can never match. Exit 2 = could not run.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const controller = join(root, 'backend/src/controllers/tasks.controller.ts');
if (!existsSync(controller)) { console.error('Cannot find tasks.controller.ts'); process.exit(2); }

const src = readFileSync(controller, 'utf8');

// Statuses listTasks can put on a row: the computed ones plus those it passes
// through untouched.
const listTasks = src.slice(src.indexOf('export async function listTasks'),
                            src.indexOf('// ── Complete a task'));
const emitted = new Set();
for (const m of listTasks.matchAll(/computed\s*=\s*'([a-z_]+)'/g)) emitted.add(m[1]);
for (const m of listTasks.matchAll(/status:\s*'([a-z_]+)'/g)) emitted.add(m[1]);
for (const m of listTasks.matchAll(/t\.status === '([a-z_]+)'/g)) emitted.add(m[1]);
// NOT the values the mutation endpoints write. A status written to the table is
// only emitted if listTasks passes it through — and 'pending' is written (by
// reopen) but never passed through, so counting writes let `=== 'pending'`
// slip past this guard again. The pass-through list above is the truth.

if (emitted.size < 4) {
  console.error(`Only parsed ${emitted.size} statuses from the controller — the parser is wrong.`);
  process.exit(2);
}

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

// Files that read the task list — directly, or through any hook built on it
// (useShiftTasks, and whatever comes next). A narrower match silently dropped
// the simple screens out of scope the day they moved to useShiftTasks, and the
// guard went on reporting success while checking less.
const files = walk(join(root, 'frontend/src'))
  .filter(f => /\buse\w*Tasks\b|\/tasks['"`\/]|\bround\.(now|earlier|later)\b/.test(readFileSync(f, 'utf8')));

// The simple screens must always be in scope. If they are not, the filter above
// is wrong — fail rather than pass on a smaller sample.
for (const must of ['pages/simple/CareDeck.tsx', 'pages/simple/SimpleHome.tsx', 'pages/simple/SimpleHandover.tsx']) {
  if (!files.some(f => f.endsWith(must))) {
    console.error(`check-task-status: ${must} is not being checked — the file filter has drifted.`);
    process.exit(2);
  }
}

let problems = 0, checked = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\bt(?:ask)?\.status\s*===\s*'([a-z_]+)'/g)) {
    checked++;
    if (!emitted.has(m[1])) {
      const line = text.slice(0, m.index).split('\n').length;
      console.error(`${f.replace(root + '/', '')}:${line}  compares task status to '${m[1]}', ` +
                    `which GET /tasks never returns. It will match nothing.`);
      problems++;
    }
  }
}

if (problems) {
  console.error(`\nBackend emits: ${[...emitted].sort().join(', ')}`);
  console.error(`${problems} unreachable status comparison(s).`);
  process.exit(1);
}
console.log(`Checked ${checked} task-status comparisons against ${emitted.size} statuses the API emits.`);
