import assert from 'node:assert';
const C = await import('./customassessments.impl.mjs');
const D = await import('./caredetails.impl.mjs');
const { validateCustomTool, customToTool, maxScore, validateCustomField, customFieldToDetail } = C;
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.error(`FAIL  ${n}\n      ${e.message}`); } };

const DOMAINS = ['skin_integrity', 'safety_risk', 'custom_ab12cd34'];
const def = () => ({
  name: 'Stoma care check', shortName: 'Stoma', purpose: 'Whether the stoma and skin around it are healthy.', who: 'A nurse, weekly.',
  domain: 'custom_ab12cd34', scored: true,
  sections: [{ title: 'Look', questions: [
    { key: 'colour', label: 'Stoma colour', type: 'choice', options: [{ value: 'pink', label: 'Pink and moist', points: 0 }, { value: 'dark', label: 'Dark or dusky', points: 5, alert: 'Dark stoma: tell the nurse now.' }] },
    { key: 'skin', label: 'Skin around it', type: 'multi', options: [{ value: 'ok', label: 'Healthy', points: 0 }, { value: 'red', label: 'Red', points: 1 }, { value: 'broken', label: 'Broken', points: 2 }] },
    { key: 'leaks', label: 'Leaks this week?', type: 'yesno', options: [{ value: 'yes', label: 'Yes', points: 1 }] },
    { key: 'notes', label: 'Anything else', type: 'text', optional: true },
  ] }],
  bands: [
    { from: 0, label: 'Healthy', level: 'low', actions: ['Routine stoma care.'], reviewDays: 7 },
    { from: 2, label: 'Needs attention', level: 'medium', actions: ['Tell the nurse; check the bag fit.'], reviewDays: 3, fact: 'Stoma: check bag fit at every change' },
    { from: 5, label: 'Urgent', level: 'high', actions: ['Tell the nurse now; contact the stoma nurse today.'], reviewDays: 1 },
  ],
});

t('a sound definition validates', () => assert.deepStrictEqual(validateCustomTool(def(), DOMAINS), []));
t('max score adds the best single answer, and every multi answer', () => assert.strictEqual(maxScore(def()), 5 + 3 + 1));
t('missing name, area or questions are refused in plain words', () => {
  const d = def(); d.name = ''; d.domain = 'nowhere'; d.sections = [];
  const e = validateCustomTool(d, DOMAINS);
  assert.ok(e.some(x => /name/.test(x))); assert.ok(e.some(x => /area of the care plan/.test(x))); assert.ok(e.some(x => /at least one question/.test(x)));
});
t('bands must start at 0, go up, and be reachable', () => {
  const d = def(); d.bands[0].from = 1; assert.ok(validateCustomTool(d, DOMAINS).some(x => /start at 0/.test(x)));
  const d2 = def(); d2.bands[2].from = 2; assert.ok(validateCustomTool(d2, DOMAINS).some(x => /must start above/.test(x)));
  const d3 = def(); d3.bands[2].from = 50; assert.ok(validateCustomTool(d3, DOMAINS).some(x => /highest possible score is 9/.test(x)));
});
t('points must be whole numbers 0–100; duplicate keys and one-answer choices are refused', () => {
  const d = def(); d.sections[0].questions[0].options[1].points = -2; assert.ok(validateCustomTool(d, DOMAINS).some(x => /whole numbers/.test(x)));
  const d2 = def(); d2.sections[0].questions[1].key = 'colour'; assert.ok(validateCustomTool(d2, DOMAINS).some(x => /duplicate key/.test(x)));
  const d3 = def(); d3.sections[0].questions[0].options = [{ value: 'a', label: 'A' }]; assert.ok(validateCustomTool(d3, DOMAINS).some(x => /at least 2/.test(x)));
});
t('an unscored assessment has exactly one outcome', () => {
  const d = def(); d.scored = false; assert.ok(validateCustomTool(d, DOMAINS).some(x => /one outcome/.test(x)));
  d.bands = [d.bands[1]]; assert.deepStrictEqual(validateCustomTool(d, DOMAINS), []);
});
t('the tool scores, bands, warns and suggests care plan content', () => {
  const tool = customToTool(def(), { key: 'custom:abc', version: 2 });
  assert.strictEqual(tool.version, 'custom:custom:abc:v2');
  const low = tool.evaluate({ colour: 'pink', skin: ['ok'], leaks: 'no' });
  assert.ok(low.complete); assert.strictEqual(low.score, 0); assert.strictEqual(low.level, 'low');
  const mid = tool.evaluate({ colour: 'pink', skin: ['red', 'broken'], leaks: 'no' });
  assert.strictEqual(mid.score, 3); assert.strictEqual(mid.level, 'medium'); assert.deepStrictEqual(mid.facts, ['Stoma: check bag fit at every change']);
  const high = tool.evaluate({ colour: 'dark', skin: ['ok'], leaks: 'yes' });
  assert.strictEqual(high.score, 6); assert.strictEqual(high.level, 'high'); assert.ok(high.warnings.includes('Dark stoma: tell the nurse now.'));
  assert.strictEqual(high.reviewDays, 1); assert.strictEqual(high.plan.domain, 'custom_ab12cd34'); assert.strictEqual(high.plan.riskLevel, 'high');
  assert.ok(high.reasons.some(r => /not a validated scale/.test(r)));
});
t('incomplete answers are reported; the optional text is not required', () => {
  const tool = customToTool(def(), { key: 'custom:abc', version: 1 });
  const r = tool.evaluate({ colour: 'pink' });
  assert.strictEqual(r.complete, false); assert.deepStrictEqual(r.missing.sort(), ['leaks', 'skin']);
});
t('custom fields: validated, and shown to carers only when asked', () => {
  assert.deepStrictEqual(validateCustomField({ key: 'x_bag', label: 'Bag type', type: 'select', options: ['One-piece', 'Two-piece'], fact: true, tone: 'amber' }), []);
  assert.ok(validateCustomField({ key: 'bad key', label: 'x', type: 'select', options: ['a'] }).length >= 2);
  const f = customFieldToDetail({ key: 'x_bag', label: 'Bag type', type: 'select', options: ['One-piece', 'Two-piece'], fact: true, tone: 'amber' });
  const facts = D.safetyFacts({ sections: [{ domain: 'custom_ab12cd34', details: { x_bag: 'Two-piece' } }], extraFields: { custom_ab12cd34: [f] } });
  assert.deepStrictEqual(facts.map(x => [x.text, x.tone]), [['Bag type: Two-piece', 'amber']]);
  const quiet = customFieldToDetail({ key: 'x_note', label: 'Note', type: 'text' });
  assert.deepStrictEqual(D.safetyFacts({ sections: [{ domain: 'skin_integrity', details: { x_note: 'hi' } }], extraFields: { skin_integrity: [quiet] } }), []);
});
t('custom fields are accepted by cleanDetails for their area, and nowhere else', () => {
  const f = customFieldToDetail({ key: 'x_bag', label: 'Bag type', type: 'select', options: ['One-piece', 'Two-piece'] });
  assert.deepStrictEqual(D.cleanDetails('skin_integrity', { x_bag: 'Two-piece', mattress: 'Foam' }, [f]).details, { x_bag: 'Two-piece', mattress: 'Foam' });
  assert.deepStrictEqual(D.cleanDetails('skin_integrity', { x_bag: 'Two-piece' }).details, {});
  assert.strictEqual(D.cleanDetails('skin_integrity', { x_bag: 'Three-piece' }, [f]).errors.length, 1);
});
console.log(`\ncustom assessments: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
