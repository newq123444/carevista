import assert from 'node:assert';
const { HOME_TOOLS, HOME_TOOL_ORDER, evaluateHome, cleanHomeAnswers, isHomeToolKey } = await import('./homesafety.impl.mjs');
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.error(`FAIL  ${n}\n      ${e.message}`); } };
const allYes = k => Object.fromEntries(HOME_TOOLS[k].sections.flatMap(s => s.questions).filter(q => q.type === 'choice').map(q => [q.key, q.options[0].value]));

t('eleven home checks, each with a source and a frequency', () => {
  assert.strictEqual(HOME_TOOL_ORDER.length, 11);
  for (const k of HOME_TOOL_ORDER) { assert.ok(HOME_TOOLS[k].sources.length && HOME_TOOLS[k].everyDays > 0, k); assert.ok(isHomeToolKey(k)); }
});
t('the first answer everywhere is the passing one (no failures above minor)', () => {
  for (const k of HOME_TOOL_ORDER) {
    const r = evaluateHome(k, allYes(k));
    assert.strictEqual(r.failures.filter(f => f.severity !== 'minor').length, 0, `${k}: ${JSON.stringify(r.failures)}`);
  }
});
t('a critical failure makes the level high and brings the next check within a week', () => {
  const r = evaluateHome('fire_risk_assessment', { ...allYes('fire_risk_assessment'), current: 'no' });
  assert.strictEqual(r.level, 'high'); assert.ok(r.reviewDays <= 7); assert.strictEqual(r.failures[0].severity, 'critical');
});
t('major failures sort after critical ones and make the level medium', () => {
  const r = evaluateHome('legionella', { ...allYes('legionella'), cold_20: 'no', showerheads: 'no' });
  assert.strictEqual(r.level, 'medium'); assert.deepStrictEqual(r.failures.map(f => f.severity), ['major', 'minor']);
});
t('inverted check: someone working alone at night is a failure', () => {
  assert.ok(evaluateHome('night_working', { ...allYes('night_working'), alone: 'yes' }).failures.some(f => /personal alarm/.test(f.action)));
  assert.strictEqual(evaluateHome('night_working', { ...allYes('night_working'), alone: 'no' }).failures.length, 0);
});
t('evacuation reads the PEEPs: missing PEEPs, too few night staff, no equipment', () => {
  const a = { ...allYes('evacuation'), night_staff: 2, equipment_count: 0 };
  const r = evaluateHome('evacuation', a, { residents: 24, noPeep: 2, peepRed: 5, peepAmber: 6, maxNightStaffForOne: 3, needEquipment: 4 });
  assert.strictEqual(r.level, 'high');
  assert.ok(r.failures.some(f => /no PEEP/.test(f.action)));
  assert.ok(r.failures.some(f => /needs 3 staff/.test(f.action)));
  assert.ok(r.failures.some(f => /none is available/.test(f.action)));
  assert.ok(r.notes.some(n => /5 red/.test(n)));
  const ok = evaluateHome('evacuation', { ...a, night_staff: 4, equipment_count: 4 }, { residents: 24, noPeep: 0, peepRed: 5, maxNightStaffForOne: 3, needEquipment: 4 });
  assert.strictEqual(ok.failures.length, 0);
});
t('windows: any failed restrictor is critical', () => {
  assert.strictEqual(evaluateHome('window_restrictors', { ...allYes('window_restrictors'), checked: 40, failed: 1 }).level, 'high');
});
t('hot water: an outlet too hot is critical', () => {
  assert.strictEqual(evaluateHome('hot_water', { ...allYes('hot_water'), over: 2 }).level, 'high');
});
t('incomplete checks are reported, and junk answers are dropped', () => {
  assert.strictEqual(evaluateHome('coshh', {}).complete, false);
  assert.deepStrictEqual(cleanHomeAnswers('coshh', { locked: 'maybe', evil: 1, thickener: 'yes' }), { thickener: 'yes' });
});
console.log(`\nhome safety: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
