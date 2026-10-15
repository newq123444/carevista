#!/usr/bin/env node
/**
 * Every phrase a carer sees on the simple screens must have a translation in
 * all five languages, with the same {placeholders}. A phrase added in English
 * only would silently show English to a Polish-speaking carer — this fails
 * the build instead.
 *
 * Covers: tr('…') / tf('…') literals in the carer's screens, the "not done"
 * reasons, the soft-signs lists, the default task names, and every prompt and
 * option on the quick-record sheets (read from the real quickOptions module).
 *
 * Exit 0 = complete. 1 = gaps. 2 = could not run.
 */
import { readFileSync, existsSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FE = p => join(root, 'frontend/src', p);
const LANGS = ['pl', 'ro', 'pt', 'es', 'hi'];
const CARER_FILES = [
  'pages/simple/CareDeck.tsx', 'pages/simple/QuickRecord.tsx', 'pages/simple/SimpleHandover.tsx',
  'pages/simple/SimpleHome.tsx', 'pages/simple/SomethingDifferent.tsx',
  'components/FluidPicker.tsx', 'components/PrnFollowups.tsx', 'components/OfflineBanner.tsx',
  // v87: the resident-first screens carers use.
  'components/RecordPanel.tsx', 'components/ResidentToday.tsx', 'components/InstallPrompt.tsx',
  'pages/RecordCare.tsx', 'pages/Residents.tsx', 'hooks/useResidentStatus.ts',
  'pages/Login.tsx', 'components/CarePlanView.tsx',
  // v88: what carers must know before helping.
  'components/SafetyFacts.tsx',
];

function literals(src) {
  const out = new Set();
  const q = `(['"])((?:\\\\.|(?!\\1).)*)\\1`;
  for (const m of src.matchAll(new RegExp(`\\bt[rf]\\(\\s*${q}`, 'g'))) out.add(m[2].replace(/\\'/g, "'"));
  for (const m of src.matchAll(new RegExp(`\\bt[rf]\\(\\s*[^()]*?\\?\\s*${q}\\s*:\\s*(['"])((?:\\\\.|(?!\\3).)*)\\3`, 'g'))) {
    out.add(m[2].replace(/\\'/g, "'")); out.add(m[4].replace(/\\'/g, "'"));
  }
  return out;
}

function findEsbuild() {
  const c = [join(root, 'backend/node_modules/esbuild/bin/esbuild'), join(root, 'frontend/node_modules/esbuild/bin/esbuild')];
  for (const d of (process.env.NODE_PATH || '').split(':').filter(Boolean)) c.push(join(d, 'tsx/node_modules/@esbuild/linux-x64/bin/esbuild'), join(d, 'esbuild/bin/esbuild'));
  return c.find(existsSync) || null;
}

async function quickLabels() {
  const esb = findEsbuild();
  if (!esb) { console.error('esbuild not found; cannot read the quick-record options.'); process.exit(2); }
  const dir = mkdtempSync(join(tmpdir(), 'cv-i18n-'));
  const entry = join(dir, 'e.ts');
  writeFileSync(entry, `import { specForTask } from ${JSON.stringify(FE('utils/quickOptions.ts'))};
export const all = ['personal_care','nutrition','continence','repositioning','sleep','social_wellbeing','behaviour']
  .flatMap(nt => specForTask({ note_type: nt })!.groups.flatMap(g => [g.prompt, ...g.choices.map(c => c.label)]));`);
  execFileSync(esb, [entry, '--bundle', '--format=esm', '--platform=node', '--log-level=error', `--outfile=${join(dir, 'e.mjs')}`]);
  const { all } = await import(pathToFileURL(join(dir, 'e.mjs')).href);
  rmSync(dir, { recursive: true, force: true });
  return all;
}

function loadCarer(text) {
  const dicts = {};
  for (const lang of LANGS) {
    const start = text.indexOf(`  ${lang}: {`);
    if (start < 0) { dicts[lang] = {}; continue; }
    const end = text.indexOf('\n  },', start);
    const body = text.slice(start + `  ${lang}: `.length, end + 4).replace(/,\s*}$/, '}');
    dicts[lang] = JSON.parse(body.replace(/,\n  }$/, '\n  }'));
  }
  return dicts;
}

function check(keys, dicts) {
  const problems = [];
  for (const k of keys) {
    const ph = (k.match(/\{\w+\}/g) || []).sort().join();
    for (const lang of LANGS) {
      const v = dicts[lang]?.[k];
      if (v == null) problems.push(`${lang}: missing "${k}"`);
      else if ((v.match(/\{\w+\}/g) || []).sort().join() !== ph) problems.push(`${lang}: placeholders differ in "${k}"`);
    }
  }
  return problems;
}

const keys = new Set();
for (const f of CARER_FILES) for (const s of literals(readFileSync(FE(f), 'utf8'))) keys.add(s);
const deck = readFileSync(FE('pages/simple/CareDeck.tsx'), 'utf8');
const reasons = deck.slice(deck.indexOf('const REASONS'), deck.indexOf('];', deck.indexOf('const REASONS')));
for (const m of reasons.matchAll(/\['([^']+)',\s*'[^']+',\s*'([^']+)'\]/g)) { keys.add(m[1]); keys.add(m[2]); }
const soft = readFileSync(FE('constants/softSigns.ts'), 'utf8');
for (const m of soft.matchAll(/label: '((?:\\'|[^'])+)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
for (const m of soft.matchAll(/\['[a-z_0-9]+',\s+'([^']+)'\]/g)) keys.add(m[1]);
const tasks = readFileSync(join(root, 'backend/src/controllers/tasks.controller.ts'), 'utf8');
for (const m of tasks.matchAll(/\{ name: '([^']+)',\s+icon/g)) keys.add(m[1]);
for (const s of await quickLabels()) keys.add(s);
// v87: labels held in data rather than written inline.
for (const f of ['components/RecordPanel.tsx', 'hooks/useResidentStatus.ts', 'pages/Login.tsx', 'components/CarePlanView.tsx']) {
  const src = readFileSync(FE(f), 'utf8');
  for (const m of src.matchAll(/label: (['"])((?:\\.|(?!\1).)*)\1/g)) keys.add(m[2].replace(/\\'/g, "'"));
  const areas = /AREA_LABEL[^{]*\{([^}]*)\}/.exec(src);
  if (areas) for (const m of areas[1].matchAll(/:\s*'([^']+)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/label: [^,\n]*\?\s*'([^']+)'\s*:\s*'([^']+)'/g)) { keys.add(m[1]); keys.add(m[2]); }
}
{
  const src = readFileSync(FE('components/CarePlanView.tsx'), 'utf8') + readFileSync(FE('pages/Login.tsx'), 'utf8');
  for (const m of src.matchAll(/^\s*\['([^']+)', plan\./gm)) keys.add(m[1]);
  for (const m of src.matchAll(/(?:hint|text): '((?:\\'|[^'])+)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
  for (const name of ['DAYS', 'LEVELS']) {
    const arr = new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(src);
    if (arr) for (const m of arr[1].matchAll(/'([^']+)'/g)) keys.add(m[1]);
  }
  const names = /ASSESSMENT_NAME[^{]*\{([^}]*)\}/.exec(src);
  if (names) for (const m of names[1].matchAll(/:\s*'([^']+)'/g)) keys.add(m[1]);
  const band = /const band = ([^;]+);/.exec(src);
  if (band) for (const m of band[1].matchAll(/'([^']+)'/g)) keys.add(m[1]);
  // Section names come from the server's list of care plan areas.
  const domains = readFileSync(join(root, 'backend/src/controllers/carePlans.controller.ts'), 'utf8');
  for (const m of domains.matchAll(/label: '([^']+)'/g)) keys.add(m[1].replace(/^[^A-Za-z]+/, ''));
  // Assessment levels, shown lower-case.
  for (const l of ['none', 'low', 'medium', 'high', 'very high', 'mild', 'moderate', 'severe']) keys.add(l);
}
{
  // v88: the names of each care plan detail (IDDSI level, sling size…) as
  // carers see them on a need. The values are the record's own words.
  const det = readFileSync(join(root, 'backend/src/services/careDetails.ts'), 'utf8');
  for (const m of det.matchAll(/\{ key: '[A-Za-z]+', label: '([^']+)', type:/g)) keys.add(m[1]);
  const cpv = readFileSync(FE('components/CarePlanView.tsx'), 'utf8');
  const prog = /PROGRESS_LABEL[^{]*\{([^}]*)\}/.exec(cpv);
  if (prog) for (const m of prog[1].matchAll(/:\s*'([^']+)'/g)) keys.add(m[1]);
}
for (const k of [...keys]) if (!/[A-Za-z]/.test(k)) keys.delete(k);

const dicts = loadCarer(readFileSync(FE('i18n/carer.ts'), 'utf8'));

// Self-test: a phrase nobody translated must be caught.
if (check(['A phrase nobody translated {n}'], dicts).length !== LANGS.length) {
  console.error('check-i18n self-test failed: it did not notice a missing phrase.'); process.exit(2);
}
if (keys.size < 400) { console.error(`check-i18n found only ${keys.size} phrases — the extraction has broken.`); process.exit(2); }

const problems = check([...keys], dicts);
if (problems.length) {
  console.error((process.env.ALL ? problems : problems.slice(0, 40)).join('\n'));
  console.error(`\n${problems.length} translation gap(s). Add them to frontend/src/i18n/carer.ts.`);
  process.exit(1);
}
console.log(`All ${keys.size} carer-screen phrases have all ${LANGS.length} translations (self-test passed).`);
