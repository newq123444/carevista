// The soft-signs keys on the screen and on the server must be the same list:
// a key the server doesn't know is refused, and a carer's alert is lost.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); } };

const fe = readFileSync(join(here, '../../frontend/src/constants/softSigns.ts'), 'utf8');
const be = readFileSync(join(here, '../src/constants/softSigns.ts'), 'utf8');
const block = (src, start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));
const feKeys = b => [...b.matchAll(/key: '([a-z_0-9]+)'.*?label: '([^']+)'/g)].map(m => [m[1], m[2]]);
const beKeys = b => [...b.matchAll(/^\s+([a-z_0-9]+):\s+'([^']+)'/gm)].map(m => [m[1], m[2]]);

t('emergency signs match, key and wording', () => {
  assert.deepStrictEqual(feKeys(block(fe, 'EMERGENCY_SIGNS', '];')), beKeys(block(be, 'EMERGENCY_SIGN_LABELS', '};')));
});
t('soft signs match, key and wording', () => {
  assert.deepStrictEqual(feKeys(block(fe, 'SOFT_SIGNS:', '];')), beKeys(block(be, 'SOFT_SIGN_LABELS', '};')));
});
t('outcomes match the database constraint', () => {
  const sql = readFileSync(join(here, '../migrations/037_soft_signs.sql'), 'utf8');
  const dbList = [...block(sql, 'det_outcome_valid', ')),').matchAll(/'([a-z_0-9]+)'/g)].map(m => m[1]);
  const feList = [...block(fe, 'OUTCOMES', '];').matchAll(/\['([a-z_0-9]+)'/g)].map(m => m[1]);
  const beList = [...block(be, 'DETERIORATION_OUTCOMES', '] as const').matchAll(/'([a-z_0-9]+)'/g)].map(m => m[1]);
  assert.deepStrictEqual(feList, dbList);
  assert.deepStrictEqual(beList, dbList);
});
t('lists are not empty (the regexes still find something)', () => {
  assert.ok(feKeys(block(fe, 'SOFT_SIGNS:', '];')).length >= 10);
  assert.ok(feKeys(block(fe, 'EMERGENCY_SIGNS', '];')).length >= 5);
});
console.log(`\nsoft signs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
