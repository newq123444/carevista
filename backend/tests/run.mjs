#!/usr/bin/env node
/**
 * Test runner.
 *
 * The backend has no node_modules here, so tests cannot import the TypeScript
 * sources directly. Rather than keep a hand-written JS copy of the code under
 * test — which drifts, and then the tests pass against a file nobody ships —
 * this transpiles the real source with esbuild and imports that.
 *
 * The tests therefore always run against the code that actually ships.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function findEsbuild() {
  const candidates = [
    join(root, 'node_modules/esbuild/bin/esbuild'),
    join(root, '../frontend/node_modules/esbuild/bin/esbuild'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  for (const d of (process.env.NODE_PATH || '').split(':').filter(Boolean)) {
    for (const p of ['esbuild/bin/esbuild', 'tsx/node_modules/@esbuild/linux-x64/bin/esbuild']) {
      const c = join(d, p);
      if (existsSync(c)) return c;
    }
  }
  try {
    const p = execFileSync('command', ['-v', 'esbuild'], { shell: true, encoding: 'utf8' }).trim();
    if (p) return p;
  } catch { /* not on PATH */ }
  return null;
}

const esbuild = findEsbuild();
if (!esbuild) {
  console.error('Could not find esbuild. Run `npm install` in backend/, or set NODE_PATH.');
  process.exit(2);
}

// Which source file backs which test.
const UNDER_TEST = {
  'canonical.impl.mjs': 'src/utils/canonical.ts',
  'integrity.impl.mjs': 'src/services/integrityChecks.ts',
  'merkle.impl.mjs':    'src/services/merkle.ts',
  // Frontend-side, but pure and consequential: this builds the words that
  // end up in a care record, so it is tested with everything else.
  'quickoptions.impl.mjs': '../frontend/src/utils/quickOptions.ts',
  'roundwindow.impl.mjs':  '../frontend/src/utils/roundWindow.ts',
  'intakesummary.impl.mjs': '../frontend/src/utils/intakeSummary.ts',
  'mca.impl.mjs':           'src/services/mcaEngine.ts',
  'hometime.impl.mjs':      'src/utils/homeTime.ts',
  'preflight.impl.mjs':     'src/utils/preflight.ts',
  'weighttrend.impl.mjs':   '../frontend/src/utils/weightTrend.ts',
  'prnfollowup.impl.mjs':   '../frontend/src/utils/prnFollowup.ts',
  'offlinequeue.impl.mjs':  '../frontend/src/utils/offlineQueue.ts',
  'clienttime.impl.mjs':    'src/utils/clientTime.ts',
  'tsa.impl.mjs':           'src/services/tsa.ts',
  'pilotmetrics.impl.mjs':  'src/services/pilotMetrics.ts',
  'planschedule.impl.mjs':  'src/services/planSchedule.ts',
  'recordmatch.impl.mjs':   '../frontend/src/utils/recordMatch.ts',
  // v88: the clinical assessment tools and structured care plan details.
  'assessments.impl.mjs':   'src/services/assessmentTools.ts',
  'caredetails.impl.mjs':   'src/services/careDetails.ts',
  'homesafety.impl.mjs':    'src/services/homeSafetyTools.ts',
  'duplicaterules.impl.mjs': 'src/utils/duplicateRules.ts',
  'customassessments.impl.mjs': 'src/services/customAssessments.ts',
};

for (const [out, src] of Object.entries(UNDER_TEST)) {
  const full = join(root, src);
  if (!existsSync(full)) continue;
  // Bundle rather than only strip types: some of these import their data from
  // elsewhere in the repo, and a transpiled-but-unbundled file leaves those
  // imports pointing at paths that do not exist next to the test.
  execFileSync(esbuild, [full, '--bundle', '--format=esm', '--platform=node',
                         '--log-level=error', '--outfile=' + join(here, out)],
    { stdio: ['ignore', 'ignore', 'inherit'] });
}

const tests = readdirSync(here).filter(f => f.endsWith('.test.mjs')).sort();
if (tests.length === 0) { console.error('No tests found.'); process.exit(2); }

let failed = 0;
for (const t of tests) {
  try {
    execFileSync(process.execPath, [join(here, t)], { stdio: 'inherit' });
  } catch { failed++; }
}

for (const out of Object.keys(UNDER_TEST)) rmSync(join(here, out), { force: true });

if (failed) { console.error(`\n${failed} test file(s) failed.`); process.exit(1); }
console.log('\nAll test files passed.');
