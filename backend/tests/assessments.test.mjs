import assert from 'node:assert';
const M = await import('./assessments.impl.mjs');
const { TOOLS, TOOL_ORDER, evaluate, cleanAnswers, missingAnswers, bmiOf, lossPct, timesEvery } = M;
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.error(`FAIL  ${n}\n      ${e.message}`); } };

// ── whole-registry properties ────────────────────────────────────────────────
t('21 tools (9 from v88, 12 from v89), each with a version, a source and a care plan domain', () => {
  assert.strictEqual(TOOL_ORDER.length, 21);
  assert.strictEqual(new Set(TOOL_ORDER).size, 21);
  assert.deepStrictEqual([...TOOL_ORDER].sort(), Object.keys(TOOLS).sort());
  for (const k of TOOL_ORDER) {
    const tool = TOOLS[k];
    assert.ok(tool.version && tool.version.includes('/cv'), `${k} version`);
    assert.ok(tool.sources.length >= 1 && tool.sources.every(s => /^https:\/\//.test(s.url)), `${k} sources`);
    assert.ok(tool.domain, `${k} domain`);
  }
});
t('an empty assessment is never complete, for every tool', () => {
  for (const k of TOOL_ORDER) assert.strictEqual(evaluate(k, {}).complete, false, k);
});
t('question keys are unique within each tool', () => {
  for (const k of TOOL_ORDER) {
    const keys = TOOLS[k].sections.flatMap(s => s.questions.map(q => q.key));
    assert.strictEqual(new Set(keys).size, keys.length, k);
  }
});
t('every choice option has a unique value', () => {
  for (const k of TOOL_ORDER) for (const s of TOOLS[k].sections) for (const q of s.questions) if (q.options) {
    const v = q.options.map(o => o.value);
    assert.strictEqual(new Set(v).size, v.length, `${k}.${q.key}`);
  }
});
t('evaluate never throws on junk answers', () => {
  const junk = [{ a: 1 }, { build: 7, skin: 'x', tissue: [null] }, { weight_kg: 'abc' }, { day: ['x'] }];
  for (const k of TOOL_ORDER) for (const j of junk) evaluate(k, cleanAnswers(k, j));
});

// ── cleanAnswers ─────────────────────────────────────────────────────────────
t('cleanAnswers drops unknown keys, bad options and hidden questions', () => {
  const c = cleanAnswers('waterlow', { build: 'average', hacker: 'x', sex: 'other', lost_weight: 'no', weight_lost: '5-10', skin: ['dry', 'nope'] });
  assert.deepStrictEqual(c, { build: 'average', lost_weight: 'no', skin: ['dry'] });
});
t('cleanAnswers coerces numbers and checks dates', () => {
  const c = cleanAnswers('must', { weight_kg: '61.5', height_cm: 'tall' });
  assert.strictEqual(c.weight_kg, 61.5); assert.ok(!('height_cm' in c));
  const d = cleanAnswers('oral_health', { last_visit: '2026-02-30x' });
  assert.ok(!('last_visit' in d));
});
t('cleanAnswers is not fooled by a non-object', () => {
  assert.deepStrictEqual(cleanAnswers('peep', 'drop table'), {});
  assert.deepStrictEqual(cleanAnswers('peep', ['x']), {});
});

// ── Waterlow ─────────────────────────────────────────────────────────────────
const W0 = { build: 'average', sex: 'male', age: '14-49', skin: ['healthy'], continence: 'complete', mobility: 'fully', lost_weight: 'no', eating_poorly: 'no', tissue: ['none'], neuro: 'none', surgery: 'none', medication: 'no' };
t('Waterlow minimum (young, healthy man) = 2, not at risk', () => {
  const r = evaluate('waterlow', W0);
  assert.ok(r.complete); assert.strictEqual(r.score, 2); assert.strictEqual(r.level, 'low');
});
t('Waterlow totals add up exactly', () => {
  const r = evaluate('waterlow', { ...W0, sex: 'female', age: '81+', build: 'below', skin: ['dry', 'tissue_paper', 'discoloured'], continence: 'both', mobility: 'chairbound', lost_weight: 'yes', weight_lost: '5-10', eating_poorly: 'yes', tissue: ['pvd', 'smoking'], neuro: '5', surgery: 'table6', medication: 'yes' });
  // build3 sex2 age5 skin4 cont3 mob5 nutrition(2+1)=3 tissue6 neuro5 surgery8 meds4 = 48
  assert.strictEqual(r.score, 48); assert.strictEqual(r.level, 'very_high');
});
t('Waterlow bands at 9/10/14/15/19/20', () => {
  // male(1) + age 81+(5) = 6 base with everything else 0
  const base = { ...W0, age: '81+' };
  const score = extra => evaluate('waterlow', { ...base, ...extra });
  const cases = [
    [{ continence: 'both' }, 9, 'low'],
    [{ continence: 'both', mobility: 'restless' }, 10, 'medium'],
    [{ continence: 'both', mobility: 'apathetic', skin: ['dry', 'oedematous'] }, 13 , 'medium'],
    [{ continence: 'both', mobility: 'restricted', skin: ['dry', 'oedematous'] }, 14, 'medium'],
    [{ continence: 'both', mobility: 'bedbound', skin: ['dry', 'oedematous'] }, 15, 'high'],
    [{ continence: 'both', mobility: 'chairbound', skin: ['broken', 'dry'] }, 18, 'high'],
    [{ continence: 'both', mobility: 'chairbound', skin: ['broken', 'dry'], eating_poorly: 'yes' }, 19, 'high'],
    [{ continence: 'both', mobility: 'chairbound', skin: ['broken', 'dry'], lost_weight: 'unsure' }, 20, 'very_high'],
  ];
  for (const [extra, s, lvl] of cases) { const r = score(extra); assert.strictEqual(r.score, s, JSON.stringify(extra)); assert.strictEqual(r.level, lvl, `${s}`); }
});
t('Waterlow nutrition: "unsure" scores 2 and hides the amount question', () => {
  const r = evaluate('waterlow', { ...W0, lost_weight: 'unsure' });
  assert.ok(r.complete); assert.strictEqual(r.score, 4);
  assert.ok(missingAnswers(TOOLS.waterlow, { ...W0, lost_weight: 'yes' }).includes('weight_lost'));
});
t('Waterlow nutrition over 2 prompts a MUST', () => {
  const r = evaluate('waterlow', { ...W0, lost_weight: 'yes', weight_lost: '10-15' });
  assert.ok(r.actions.some(a => /complete a MUST/.test(a)));
});
t('Waterlow "Healthy" with another skin type is an error', () => {
  assert.ok(evaluate('waterlow', { ...W0, skin: ['healthy', 'dry'] }).errors.length);
});
t('Waterlow at-risk: 6-hourly; high: 4-hourly + high-spec foam mattress (NICE CG179)', () => {
  const atRisk = evaluate('waterlow', { ...W0, age: '81+', continence: 'both', mobility: 'restless' });
  assert.strictEqual(atRisk.plan.details.repositionHours, 6);
  assert.deepStrictEqual(atRisk.plan.schedule.map(s => s.time), ['00:00', '06:00', '12:00', '18:00']);
  const high = evaluate('waterlow', { ...W0, age: '81+', continence: 'both', mobility: 'bedbound', skin: ['dry', 'oedematous'] });
  assert.strictEqual(high.plan.details.repositionHours, 4);
  assert.deepStrictEqual(high.plan.schedule.map(s => s.time), ['02:00', '06:00', '10:00', '14:00', '18:00', '22:00']);
  assert.ok(high.actions.some(a => /high-specification foam mattress/.test(a)));
  assert.strictEqual(high.reviewDays, 7);
});
t('Waterlow broken skin raises a warning', () => {
  assert.ok(evaluate('waterlow', { ...W0, skin: ['broken'] }).warnings.some(w => /wound assessment/.test(w)));
});
t('Waterlow prefill from the record: age band, sex, build', () => {
  const p = TOOLS.waterlow.prefill({ ageYears: 80, sex: 'Female', weightKg: 50, heightCm: 165 });
  assert.deepStrictEqual(p, { build: 'below', sex: 'female', age: '75-80' });
  assert.strictEqual(TOOLS.waterlow.prefill({ ageYears: 81 }).age, '81+');
});

// ── MUST ─────────────────────────────────────────────────────────────────────
t('BMI and weight-loss maths', () => {
  assert.strictEqual(bmiOf(60, 160), 23.4);
  assert.strictEqual(bmiOf(60, 50), null);
  assert.strictEqual(lossPct(54, 60), 10);
  assert.strictEqual(lossPct(60, null), null);
});
t('MUST 0 / 1 / 2+ → low / medium / high with BAPEN actions', () => {
  const r0 = evaluate('must', { bmi_band: 'over20', loss_band: 'under5', acute: 'no' });
  assert.strictEqual(r0.level, 'low'); assert.ok(r0.actions.some(a => /monthly/.test(a)));
  const r1 = evaluate('must', { bmi_band: '18.5-20', loss_band: 'under5', acute: 'no' });
  assert.strictEqual(r1.level, 'medium'); assert.ok(r1.actions.some(a => /3 days/.test(a)));
  const r2 = evaluate('must', { bmi_band: 'under18.5', loss_band: 'under5', acute: 'no' });
  assert.strictEqual(r2.level, 'high'); assert.ok(r2.actions.some(a => /dietitian/.test(a)));
  const r6 = evaluate('must', { bmi_band: 'under18.5', loss_band: 'over10', acute: 'yes' });
  assert.strictEqual(r6.score, 6); assert.ok(r6.warnings.length);
});
t('MUST warns when the chosen band disagrees with the measurements', () => {
  const r = evaluate('must', { weight_kg: 45, height_cm: 165, bmi_band: 'over20', loss_band: 'under5', acute: 'no' });
  assert.ok(r.warnings.some(w => /BMI of 16.5/.test(w)));
});
t('MUST prefill computes bands from the record (exactly 10% is 5–10%, as MUST says)', () => {
  assert.strictEqual(TOOLS.must.prefill({ weightKg: 54, pastWeightKg: 60 }).loss_band, '5-10');
  const p = TOOLS.must.prefill({ weightKg: 54, heightCm: 175, pastWeightKg: 61 });
  assert.strictEqual(p.bmi_band, 'under18.5'); assert.strictEqual(p.loss_band, 'over10');
});
t('MUST high: weekly weigh on a Monday plus snacks on the care day', () => {
  const r = evaluate('must', { bmi_band: 'under18.5', loss_band: 'under5', acute: 'no' });
  assert.ok(r.plan.schedule.some(s => s.dayOfWeek === 1 && /Weigh/.test(s.what)));
  assert.strictEqual(r.plan.details.fortified, true);
});

// ── Falls ────────────────────────────────────────────────────────────────────
const FALLS_NO = Object.fromEntries(['history', 'fear', 'mobility', 'medicines', 'postural', 'cognition', 'continence', 'vision', 'feet', 'conditions', 'environment', 'injury'].map(k => [k, 'no']));
t('Falls has no score and no risk level (NICE NG249)', () => {
  const r = evaluate('falls', { ...FALLS_NO, mobility: 'yes', mobility_actions: ['supervise'] });
  assert.strictEqual(r.score, null); assert.strictEqual(r.level, 'not_scored');
  assert.strictEqual(r.plan.riskLevel, undefined);
  assert.strictEqual(r.headline, '1 thing to act on');
});
t('Falls: every concern needs an action or a written plan', () => {
  const r = evaluate('falls', { ...FALLS_NO, vision: 'yes' });
  assert.ok(r.errors.some(e => /Sight/.test(e)));
  const ok = evaluate('falls', { ...FALLS_NO, vision: 'yes', vision_note: 'Optician booked for Tuesday' });
  assert.strictEqual(ok.errors.length, 0);
  assert.ok(ok.actions.some(a => /Optician/.test(a)));
});
t('Falls: chosen precautions become carer facts in the plan details', () => {
  const r = evaluate('falls', { ...FALLS_NO, feet: 'yes', feet_actions: ['footwear', 'podiatry'], environment: 'yes', environment_actions: ['bell'] });
  assert.deepStrictEqual(r.plan.details.fallsPrecautions, ['Well-fitting footwear with a back — never socks only', 'Call bell within reach']);
});
t('Falls: two or more falls in a year → refer to falls service', () => {
  const r = evaluate('falls', { ...FALLS_NO, history: 'yes', falls_count: 3, history_actions: ['pattern'] });
  assert.ok(r.warnings.some(w => /falls service/.test(w)));
});
t('Falls: "could not assess" is allowed but flagged', () => {
  const r = evaluate('falls', { ...FALLS_NO, cognition: 'unknown' });
  assert.ok(r.complete); assert.ok(r.warnings.some(w => /could not be assessed/.test(w)));
});

// ── Moving and handling ──────────────────────────────────────────────────────
const MH_BASE = { weight_kg: 70, weight_bearing: 'none', sitting_balance: 'no', grip: 'no', cooperation: 'yes', factors: ['none'],
  reposition_staff: '2', reposition_equip: ['slide_sheet'], bed_chair_staff: '2', bed_chair_equip: ['full_hoist'],
  sit_stand_staff: 'na', walking_staff: 'na', toilet_staff: '2', toilet_equip: ['full_hoist'], bathing_staff: '2', bathing_equip: ['bath_hoist'],
  floor_staff: '2', floor_equip: ['full_hoist'], sling_type: 'general', sling_size: 'M', sling_loops: 'Shoulder green, leg blue crossed' };
t('Moving & handling: full hoist plan is complete, high dependency, with sling in the facts', () => {
  const r = evaluate('moving_handling', MH_BASE);
  assert.ok(r.complete, JSON.stringify(r.missing)); assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.level, 'high');
  assert.strictEqual(r.plan.staff, '2 carers');
  assert.ok(r.facts.some(f => /Sling: .*size M/.test(f)));
  assert.strictEqual(r.plan.details.slingSize, 'M');
  assert.strictEqual(r.plan.details.walkingAid, 'none_walks');
  assert.ok(r.actions.some(a => /LOLER/.test(a)));
});
t('Moving & handling: a hoist with no sling size or loops is incomplete', () => {
  const { sling_size, sling_loops, ...rest } = MH_BASE;
  const r = evaluate('moving_handling', rest);
  assert.ok(r.missing.includes('sling_size')); assert.ok(r.missing.includes('sling_loops'));
});
t('Moving & handling: one-carer full hoist warns', () => {
  const r = evaluate('moving_handling', { ...MH_BASE, bed_chair_staff: '1' });
  assert.ok(r.warnings.some(w => /two trained carers/.test(w)));
});
t('Moving & handling: standing aid without weight-bearing warns; walking without weight-bearing is an error', () => {
  const r = evaluate('moving_handling', { ...MH_BASE, sit_stand_staff: '1', sit_stand_equip: ['stand_aid'] });
  assert.ok(r.warnings.some(w => /bear some weight/.test(w)));
  const r2 = evaluate('moving_handling', { ...MH_BASE, walking_staff: '2', walking_equip: ['frame'] });
  assert.ok(r2.errors.some(e => /Walking/.test(e)));
});
t('Moving & handling: lifting from the floor by hand is warned against', () => {
  const r = evaluate('moving_handling', { ...MH_BASE, floor_equip: ['none'] });
  assert.ok(r.warnings.some(w => /never lift a person from the floor by hand/.test(w)));
});
t('Moving & handling: independent person is low, with no hoist questions', () => {
  const ind = { weight_kg: 60, weight_bearing: 'full', sitting_balance: 'yes', grip: 'yes', cooperation: 'yes', factors: ['none'],
    reposition_staff: 'independent', reposition_equip: ['none'], bed_chair_staff: 'independent', bed_chair_equip: ['none'], sit_stand_staff: 'independent', sit_stand_equip: ['none'],
    walking_staff: 'independent', walking_equip: ['stick'], toilet_staff: 'independent', toilet_equip: ['none'], bathing_staff: 'supervision', bathing_equip: ['grab_rails'], floor_staff: 'na' };
  const r = evaluate('moving_handling', ind);
  assert.ok(r.complete, JSON.stringify(r.missing)); assert.strictEqual(r.level, 'medium'); // uses grab rails/stick = some equipment
  assert.strictEqual(r.plan.details.walkingAid, 'stick');
  assert.ok(!missingAnswers(TOOLS.moving_handling, ind).includes('sling_type'));
});
t('Moving & handling: bariatric weight warns about safe working loads', () => {
  assert.ok(evaluate('moving_handling', { ...MH_BASE, weight_kg: 160 }).warnings.some(w => /safe working load/.test(w)));
});

// ── Bed rails ────────────────────────────────────────────────────────────────
const ALL_CHECKS = ['compatible', 'gaps', 'height', 'secure', 'maintained'];
const BR = { fall_from_bed: 'yes', gets_out: 'no', confused: 'no', atypical: 'no', involuntary: 'no', wishes: 'want', capacity: 'yes', alternatives: ['low_bed'], decision: 'rails', rail_sides: 'both', bumpers: 'no', checks: ALL_CHECKS };
t('Bed rails: all safety checks are required before rails are used', () => {
  assert.deepStrictEqual(evaluate('bed_rails', BR).errors, []);
  const r = evaluate('bed_rails', { ...BR, checks: ['compatible'] });
  assert.strictEqual(r.errors.length, 4);
});
t('Bed rails: a person with capacity who refuses cannot have rails', () => {
  const r = evaluate('bed_rails', { ...BR, wishes: 'dont_want' });
  assert.ok(r.errors.some(e => /against their wishes/.test(e)));
});
t('Bed rails: climbing risk, entrapment risk and no alternatives all warn (MHRA)', () => {
  const r = evaluate('bed_rails', { ...BR, confused: 'yes', atypical: 'yes', involuntary: 'yes', alternatives: [] });
  assert.ok(r.warnings.some(w => /climb over/.test(w)));
  assert.ok(r.warnings.some(w => /BS EN 50637/.test(w)));
  assert.ok(r.warnings.some(w => /bumpers/.test(w)));
  assert.ok(r.warnings.some(w => /alternatives/.test(w)));
});
t('Bed rails: no rails → alternatives become the plan, and the checks are not asked', () => {
  const r = evaluate('bed_rails', { ...BR, decision: 'no_rails', alternatives: ['low_bed', 'mat'], checks: undefined, rail_sides: undefined, bumpers: undefined });
  assert.ok(r.complete, JSON.stringify(r.missing));
  assert.strictEqual(r.plan.details.bedRails, 'No');
  assert.deepStrictEqual(r.plan.details.bedRailAlternatives, ['Low or ultra-low bed', 'Crash mat beside the bed']);
  assert.ok(!r.plan.schedule);
});
t('Bed rails in use → a nightly check on the care day', () => {
  assert.strictEqual(evaluate('bed_rails', BR).plan.schedule[0].time, '21:00');
});

// ── Eating, drinking and choking ─────────────────────────────────────────────
const ED = { signs: ['none'], salt: 'no', food_level: '7', drink_level: '0', choking: ['none'], support: 'independent' };
t('Eating: no signs, regular diet → low, no SALT referral', () => {
  const r = evaluate('eating_drinking', ED);
  assert.ok(r.complete); assert.strictEqual(r.level, 'low'); assert.ok(!r.actions.some(a => /SALT/.test(a)));
});
t('Eating: signs without current SALT advice → refer and warn', () => {
  const r = evaluate('eating_drinking', { ...ED, signs: ['cough', 'wet_voice'] });
  assert.strictEqual(r.level, 'high');
  assert.ok(r.actions.some(a => /speech and language therapy/.test(a)));
  assert.ok(r.warnings.length);
});
t('Eating: modified textures need a source, and non-SALT levels are warned', () => {
  const m = { ...ED, food_level: '5', drink_level: '2' };
  assert.ok(missingAnswers(TOOLS.eating_drinking, m).includes('level_source'));
  const r = evaluate('eating_drinking', { ...m, level_source: 'interim' });
  assert.ok(r.warnings.some(w => /set by a SALT/.test(w)));
  assert.strictEqual(r.plan.details.iddsiFood, '5');
});
t('Eating: "None of these" with a sign is an error', () => {
  assert.ok(evaluate('eating_drinking', { ...ED, signs: ['none', 'cough'] }).errors.length);
});

// ── Oral health (OHAT) ───────────────────────────────────────────────────────
const OH = { lips: '0', tongue: '0', gums: '0', saliva: '0', teeth: '0', dentures: 'na', cleanliness: '0', pain: '0', brushing: 'independent', denture_type: 'none', dentist: 'yes', refuses: 'no' };
t('OHAT referral rules: any 2, total 5+, or dental pain', () => {
  assert.strictEqual(evaluate('oral_health', OH).level, 'low');
  assert.strictEqual(evaluate('oral_health', { ...OH, lips: '1', tongue: '1' }).level, 'medium');
  assert.strictEqual(evaluate('oral_health', { ...OH, gums: '2' }).level, 'high');
  assert.strictEqual(evaluate('oral_health', { ...OH, lips: '1', tongue: '1', gums: '1', saliva: '1', cleanliness: '1' }).level, 'high');
  assert.strictEqual(evaluate('oral_health', { ...OH, pain: '1' }).level, 'high');
});
t('OHAT: "no natural teeth" scores 0, and dentures must agree with the care section', () => {
  const r = evaluate('oral_health', { ...OH, teeth: 'na', dentures: '0', denture_type: 'none' });
  assert.ok(r.errors.some(e => /scored dentures/.test(e)));
  const ok = evaluate('oral_health', { ...OH, teeth: 'na', dentures: '1', denture_type: 'both', denture_marked: 'no' });
  assert.deepStrictEqual(ok.errors, []); assert.strictEqual(ok.score, 1);
  assert.ok(ok.actions.some(a => /marked with their name/.test(a)));
  assert.ok(ok.plan.schedule.some(s => s.time === '21:00' && /dentures/.test(s.what)));
});
t('OHAT: no dentist → help to register', () => {
  assert.ok(evaluate('oral_health', { ...OH, dentist: 'no' }).actions.some(a => /register with a dentist/.test(a)));
});

// ── PEEP ─────────────────────────────────────────────────────────────────────
const P = { floor: 'first', hears: 'yes', understands: 'yes', day: 'unaided', night: 'unaided', equipment: ['none'], route: 'East stairs to the car park' };
t('PEEP categories: green / amber / red', () => {
  assert.strictEqual(evaluate('peep', P).plan.details.peepCategory, 'green');
  assert.strictEqual(evaluate('peep', { ...P, night: 'two' }).plan.details.peepCategory, 'amber');
  assert.strictEqual(evaluate('peep', { ...P, night: 'bed', equipment: ['evac_mattress'] }).plan.details.peepCategory, 'red');
});
t('PEEP: someone who may refuse cannot be green', () => {
  assert.strictEqual(evaluate('peep', { ...P, understands: 'may_refuse' }).plan.details.peepCategory, 'amber');
});
t('PEEP: needing equipment without naming it is an error; route is required', () => {
  assert.ok(evaluate('peep', { ...P, night: 'bed' }).errors.length);
  const { route, ...noRoute } = P;
  assert.ok(evaluate('peep', noRoute).missing.includes('route'));
});
t('PEEP: more help at night is flagged, and oxygen warns', () => {
  const r = evaluate('peep', { ...P, night: 'two', medical: ['oxygen'] });
  assert.ok(r.warnings.some(w => /at night/.test(w)));
  assert.ok(r.warnings.some(w => /Oxygen/.test(w)));
  assert.strictEqual(r.plan.details.peepStaffNight, 2);
});

// ── Abbey ────────────────────────────────────────────────────────────────────
t('Abbey via the engine matches the v87 bands', () => {
  const all = v => Object.fromEntries(['vocalisation', 'facial', 'body_language', 'behaviour', 'physiological', 'physical'].map(k => [k, v]));
  assert.strictEqual(evaluate('abbey_pain', all('0')).level, 'none');
  assert.strictEqual(evaluate('abbey_pain', { ...all('0'), facial: '3' }).level, 'mild');
  assert.strictEqual(evaluate('abbey_pain', all('2')).level, 'moderate');
  assert.strictEqual(evaluate('abbey_pain', { ...all('2'), facial: '3', physical: '3' }).level, 'severe');
});

t('Abbey band edges 2/3/7/8/13/14 and an unscored item is never counted as 0', () => {
  const keys = ['vocalisation', 'facial', 'body_language', 'behaviour', 'physiological', 'physical'];
  const at = n => { const o = {}; let left = n; for (const k of keys) { const v = Math.min(3, left); o[k] = String(v); left -= v; } return evaluate('abbey_pain', o); };
  assert.deepStrictEqual([2, 3, 7, 8, 13, 14, 18].map(n => at(n).level), ['none', 'mild', 'mild', 'moderate', 'moderate', 'severe', 'severe']);
  const partial = evaluate('abbey_pain', { vocalisation: '1' });
  assert.strictEqual(partial.complete, false); assert.strictEqual(partial.missing.length, 5);
  assert.strictEqual(cleanAnswers('abbey_pain', { facial: '4' }).facial, undefined);
});

// ── v89 tools ────────────────────────────────────────────────────────────────
t('4AT: published bands — 0 unlikely, 1–3 cognitive impairment, 4+ possible delirium', () => {
  const at = (alertness, amt4, months, acute) => evaluate('delirium_4at', { alertness, amt4, months, acute });
  assert.strictEqual(at('0', '0', '0', '0').score, 0); assert.strictEqual(at('0', '0', '0', '0').level, 'low');
  assert.strictEqual(at('0b', '1', '0', '0').level, 'medium');
  assert.strictEqual(at('0', '2', '1', '0').score, 3); assert.strictEqual(at('0', '2', '1', '0').level, 'medium');
  assert.strictEqual(at('0', '0', '0', '4').level, 'high');
  assert.strictEqual(at('4', '2', '2', '4').score, 12);
  const r = at('4', '0', '0', '0');
  assert.ok(r.warnings.some(w => /not a diagnosis/.test(w))); assert.strictEqual(r.reviewDays, 1);
});
const GDS_KEY = { 1: 'no', 5: 'no', 7: 'no', 11: 'no', 13: 'no' };
const gdsAll = dep => Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`g${i + 1}`, dep ? (GDS_KEY[i + 1] || 'yes') : (GDS_KEY[i + 1] ? 'yes' : 'no')]));
t('GDS-15: scored with the published key (reverse items 1, 5, 7, 11, 13)', () => {
  assert.strictEqual(evaluate('mood_gds15', { able: 'yes', ...gdsAll(false) }).score, 0);
  assert.strictEqual(evaluate('mood_gds15', { able: 'yes', ...gdsAll(true) }).score, 15);
  const four = { able: 'yes', ...gdsAll(false), g2: 'yes', g3: 'yes', g4: 'yes', g1: 'no' };
  assert.strictEqual(evaluate('mood_gds15', four).score, 4); assert.strictEqual(evaluate('mood_gds15', four).level, 'low');
  assert.strictEqual(evaluate('mood_gds15', { ...four, g6: 'yes' }).level, 'medium');
});
t('GDS-15: a few unanswered items are prorated and rounded up; more than 5 is refused', () => {
  const a = { able: 'yes', ...gdsAll(false), g2: 'yes', g3: 'yes', g4: 'yes', g5: 'na', g6: 'na', g7: 'na' };
  assert.strictEqual(evaluate('mood_gds15', a).score, Math.ceil(3 / 12 * 15));
  const many = { able: 'yes', ...gdsAll(false) }; for (let i = 1; i <= 6; i++) many[`g${i}`] = 'na';
  assert.ok(evaluate('mood_gds15', many).errors.length);
});
t('GDS-15: someone who cannot answer is routed to observation, with no score', () => {
  const r = evaluate('mood_gds15', { able: 'no' });
  assert.ok(r.complete); assert.strictEqual(r.score, null); assert.strictEqual(r.level, 'not_scored');
  assert.ok(missingAnswers(TOOLS.mood_gds15, { able: 'yes' }).includes('g1'));
});
t('GDS-15: hopeless or worthless answers prompt the emotional safety question', () => {
  assert.ok(evaluate('mood_gds15', { able: 'yes', ...gdsAll(false), g14: 'yes' }).warnings.some(w => /emotional safety/.test(w)));
});
const BS = { signs: ['shouting'], early: 'Pacing', triggers: ['personal_care'], physical_check: 'yes', prevent: 'Same two carers', calm: 'Step back, offer tea', psychotropic: 'no', restrictive: ['none'], abc: 'no' };
t('Behaviour support: needs what prevents and what calms; medicines and restrictions warn', () => {
  assert.ok(evaluate('behaviour_support', BS).complete);
  assert.ok(evaluate('behaviour_support', { ...BS, calm: '' }).missing.includes('calm'));
  assert.ok(evaluate('behaviour_support', { ...BS, psychotropic: 'prn' }).warnings.some(w => /non-drug/.test(w)));
  assert.ok(evaluate('behaviour_support', { ...BS, restrictive: ['locked'] }).warnings.some(w => /DoLS/.test(w)));
  assert.strictEqual(evaluate('behaviour_support', BS).plan.details.whatHelps, 'Step back, offer tea');
});
const LB = { goes_out: 'with_others', attempts: 'often', road: 'poor', finds_way: 'no', capacity: 'no_bi', dols: 'unknown', measures: [] };
t('Leaving the building: likely deprivation of liberty without DoLS is flagged; Herbert Protocol prompted', () => {
  const r = evaluate('leaving_building', LB);
  assert.strictEqual(r.level, 'high');
  assert.ok(r.warnings.some(w => /DoLS/.test(w)));
  assert.ok(r.actions.some(a => /Herbert Protocol/.test(a)));
  assert.ok(r.actions.some(a => /call 999/.test(a)));
  const ok = evaluate('leaving_building', { ...LB, dols: 'granted', measures: ['herbert'] });
  assert.ok(!ok.warnings.some(w => /Apply for a DoLS/.test(w)));
  assert.strictEqual(ok.plan.details.herbertProtocol, true);
});
t('Leaving the building: DoLS status is prefilled from the register', () => {
  assert.strictEqual(TOOLS.leaving_building.prefill({ dolsStatus: 'granted' }).dols, 'granted');
  assert.strictEqual(TOOLS.leaving_building.prefill({ dolsStatus: 'standard_applied' }).dols, 'applied');
});
t('Hydration: target above a doctor\'s restriction is refused; a high risk schedules drinks', () => {
  assert.ok(evaluate('hydration', { factors: ['none'], restriction: 'yes', restriction_ml: 1000, target_ml: 1500 }).errors.length);
  const r = evaluate('hydration', { factors: ['help', 'thirst'], restriction: 'no', target_ml: 1500 });
  assert.strictEqual(r.level, 'high'); assert.strictEqual(r.plan.schedule.length, 6);
  assert.ok(evaluate('hydration', { factors: ['none'], restriction: 'no', target_ml: 900 }).warnings.length);
});
const SM = { wants: 'some', capacity: 'yes', read: 'yes', open: 'yes', know: 'yes', remember: 'yes', storage: 'yes', others: 'no', cd: 'no', level: 'partial', which: 'Inhalers', check: 'Ask daily' };
t('Self-medication: NICE SC1 — storage required, capacity respected, MAR marked', () => {
  assert.deepStrictEqual(evaluate('self_medication', SM).errors, []);
  assert.ok(evaluate('self_medication', { ...SM, storage: 'no' }).errors.length);
  assert.ok(evaluate('self_medication', { ...SM, capacity: 'no' }).errors.length);
  assert.ok(evaluate('self_medication', SM).actions.some(a => /MAR chart/.test(a)));
  assert.ok(evaluate('self_medication', { wants: 'none' }).complete);
  assert.ok(evaluate('self_medication', { ...SM, which: '' }).missing.includes('which'));
});
const PF = { smokes: 'no', emollients: 'none', oxygen: 'no', airflow: 'no', items: ['none'], react: 'yes', detector: 'yes' };
t('Personal fire risk: smoking with emollients or oxygen is high and warns (MHRA)', () => {
  assert.strictEqual(evaluate('personal_fire', PF).level, 'low');
  const em = evaluate('personal_fire', { ...PF, smokes: 'cigarettes', smoke_safely: 'yes', emollients: 'large' });
  assert.strictEqual(em.level, 'high'); assert.ok(em.warnings.some(w => /washing does not remove/.test(w)));
  const ox = evaluate('personal_fire', { ...PF, smokes: 'cigarettes', smoke_safely: 'yes', oxygen: 'yes' });
  assert.ok(ox.warnings.some(w => /never smoke/.test(w)));
  assert.ok(evaluate('personal_fire', { ...PF, smokes: 'cigarettes', smoke_safely: 'no' }).errors.length);
  assert.ok(evaluate('personal_fire', { ...PF, detector: 'no' }).warnings.some(w => /detector/.test(w)));
  assert.strictEqual(evaluate('personal_fire', { ...PF, emollients: 'some' }).plan.details.emollientFireRisk, true);
});
const WB = { use: 'pushed', source: 'nhs', checked: 'yes', cushion: 'yes', upright: 'yes', slides: 'no', belt: 'pelvic', belt_reason: 'posture', belt_assessed: 'yes', consent: 'yes' };
t('Wheelchair: harness alone is refused; sliding with a belt is high; restraint warns', () => {
  assert.deepStrictEqual(evaluate('wheelchair_belt', WB).errors, []);
  assert.ok(evaluate('wheelchair_belt', { ...WB, belt: 'harness_only' }).errors.length);
  assert.strictEqual(evaluate('wheelchair_belt', { ...WB, slides: 'yes' }).level, 'high');
  assert.ok(evaluate('wheelchair_belt', { ...WB, belt_reason: 'prevent_getting_up' }).warnings.some(w => /restraint/.test(w)));
});
const BW = { usual: 'daily', usual_type: '4', days_since: 1, factors: ['none'], signs: ['none'], laxatives: 'none' };
t('Bowels: not opened in 3 days, overflow, and pain with vomiting are each escalated', () => {
  assert.strictEqual(evaluate('bowel', BW).level, 'low');
  assert.strictEqual(evaluate('bowel', { ...BW, days_since: 3 }).level, 'medium');
  const of = evaluate('bowel', { ...BW, signs: ['overflow'] });
  assert.strictEqual(of.level, 'high'); assert.ok(of.warnings.some(w => /anti-diarrhoea/.test(w)));
  assert.ok(evaluate('bowel', { ...BW, signs: ['pain', 'vomiting'] }).warnings.some(w => /blockage/.test(w)));
  assert.ok(evaluate('bowel', { ...BW, factors: ['opioids'] }).actions.some(a => /laxative/.test(a)));
  assert.strictEqual(TOOLS.bowel.prefill({ lastBowelOpenedDays: 2 }).days_since, 2);
});
const SZ = { diagnosis: 'epilepsy', looks: 'Stiffens then jerks, 1–2 minutes', frequency: 'Monthly; last 2 Oct', rescue: 'midazolam', rescue_when: '10 mg buccal after 5 minutes; no second dose', protocol: 'yes', trained: 'yes', bathing: 'shower', night: 'checks' };
t('Seizures: rescue medicine needs a signed protocol; 999 rules always shown', () => {
  const r = evaluate('seizure', SZ);
  assert.deepStrictEqual(r.errors, []); assert.ok(r.actions.some(a => /Call 999/.test(a)));
  assert.ok(evaluate('seizure', { ...SZ, protocol: 'no' }).errors.length);
  assert.ok(evaluate('seizure', { ...SZ, rescue_when: '' }).missing.includes('rescue_when'));
  assert.ok(evaluate('seizure', { ...SZ, trained: 'no' }).warnings.length);
});
t('Catheter: overdue change warns; never dipstick; reason required', () => {
  const r = evaluate('catheter', { type: 'urethral', size: 14, balloon: 10, reason: 'Retention', inserted: '2026-01-01', change_due: '2026-01-02', drainage: 'leg_night', who_changes: 'district', still_needed: 'yes' });
  assert.ok(r.warnings.some(w => /was due/.test(w)));
  assert.ok(r.actions.some(a => /dipsticks/.test(a)));
  assert.ok(evaluate('catheter', { type: 'intermittent', who_changes: 'home', still_needed: 'yes' }).missing.includes('reason'));
});
t('Emotional safety: a plan or intent cannot be saved until the GP or mental health team is told', () => {
  const b = { what: 'Said she wants it to end', level: 'plan', history: 'no', told: ['nurse'], support: 'Her daughter; time to talk' };
  assert.ok(evaluate('emotional_safety', b).errors.some(e => /GP or mental health/.test(e)));
  assert.deepStrictEqual(evaluate('emotional_safety', { ...b, told: ['nurse', 'mh'] }).errors, []);
  assert.strictEqual(evaluate('emotional_safety', { ...b, told: ['nurse', 'mh'] }).level, 'high');
  assert.ok(evaluate('emotional_safety', { ...b, level: 'passive', told: [] }).errors.some(e => /nurse in charge/.test(e)));
});
t('Every tool marked "when needed" says when', () => {
  for (const k of ['bed_rails', 'behaviour_support', 'leaving_building', 'self_medication', 'wheelchair_belt', 'catheter', 'seizure', 'emotional_safety', 'abbey_pain'])
    assert.ok(TOOLS[k].whenNeeded, k);
});

// ── helpers ──────────────────────────────────────────────────────────────────
t('timesEvery wraps past midnight and refuses silly intervals', () => {
  assert.deepStrictEqual(timesEvery(4, '22:00', '06:00'), ['22:00', '02:00', '06:00']);
  assert.deepStrictEqual(timesEvery(0), []);
  assert.deepStrictEqual(timesEvery(13), []);
});

console.log(`\nassessments: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
