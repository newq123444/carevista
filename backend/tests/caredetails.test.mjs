import assert from 'node:assert';
const { DOMAIN_DETAILS, cleanDetails, mergeDetails, safetyFacts, detailValue } = await import('./caredetails.impl.mjs');
const A = await import('./assessments.impl.mjs');
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.error(`FAIL  ${n}\n      ${e.message}`); } };

t('every care plan domain has a details list (possibly empty)', () => {
  for (const d of ['personal_care', 'mobility_transfers', 'nutrition_hydration', 'continence', 'skin_integrity', 'medication', 'pain',
    'breathing_circulation', 'communication_sensory', 'cognition_mental_health', 'behaviour_support', 'social_emotional', 'night_care', 'safety_risk', 'end_of_life'])
    assert.ok(Array.isArray(DOMAIN_DETAILS[d]), d);
});
t('cleanDetails keeps known keys, coerces types, reports bad values', () => {
  const { details, errors } = cleanDetails('nutrition_hydration', { iddsiFood: '5', fluidTargetMl: '1500', foodChart: 'true', evil: 'x', iddsiDrink: '9' });
  assert.deepStrictEqual(details, { iddsiFood: '5', fluidTargetMl: 1500, foodChart: true });
  assert.strictEqual(errors.length, 1);
});
t('cleanDetails: "" clears, undefined is ignored', () => {
  const { details } = cleanDetails('skin_integrity', { mattress: '', cushion: undefined });
  assert.deepStrictEqual(details, { mattress: null });
});
t('cleanDetails: numbers out of range are refused', () => {
  assert.strictEqual(cleanDetails('skin_integrity', { repositionHours: 0 }).errors.length, 1);
  assert.strictEqual(cleanDetails('skin_integrity', { repositionHours: 25 }).errors.length, 1);
});
t('cleanDetails: lists from text, capped', () => {
  const { details } = cleanDetails('night_care', { bedRailAlternatives: 'Low bed, Crash mat\nSensor' });
  assert.deepStrictEqual(details.bedRailAlternatives, ['Low bed', 'Crash mat', 'Sensor']);
});
t('mergeDetails: null removes, others overwrite', () => {
  assert.deepStrictEqual(mergeDetails({ a: 1, b: 2 }, { b: null, c: 3 }), { a: 1, c: 3 });
  assert.deepStrictEqual(mergeDetails('junk', { a: 1 }), { a: 1 });
});
t('safety facts: allergies and DNACPR first, then red, then amber', () => {
  const f = safetyFacts({ allergies: 'Penicillin', dnacpr: true, sections: [
    { domain: 'skin_integrity', details: { repositionHours: 4 } },
    { domain: 'communication_sensory', details: { hearingAids: 'both' } },
    { domain: 'nutrition_hydration', details: { iddsiFood: '5', iddsiDrink: '0' } },
  ] });
  assert.deepStrictEqual(f.map(x => x.text), ['Allergies: Penicillin', 'DNACPR in place', 'Food: Level 5 — Minced & moist', 'Pressure care: change position at least every 4 hours', 'Hearing aids: both ears']);
});
t('safety facts: "No known allergies" is not a fact; not-applicable sections are skipped; regular diet is not a fact', () => {
  const f = safetyFacts({ allergies: 'NKDA', sections: [
    { domain: 'nutrition_hydration', details: { iddsiFood: '7', iddsiDrink: '0' } },
    { domain: 'skin_integrity', applicable: false, details: { repositionHours: 2 } },
  ] });
  assert.deepStrictEqual(f, []);
});
t('assessment → plan details → the same facts carers see (one source of truth)', () => {
  const mh = A.evaluate('moving_handling', { weight_kg: 70, weight_bearing: 'none', sitting_balance: 'no', grip: 'no', cooperation: 'yes', factors: ['none'],
    reposition_staff: '2', reposition_equip: ['slide_sheet'], bed_chair_staff: '2', bed_chair_equip: ['full_hoist'], sit_stand_staff: 'na', walking_staff: 'na',
    toilet_staff: '2', toilet_equip: ['full_hoist'], bathing_staff: 'na', floor_staff: '2', floor_equip: ['full_hoist'], sling_type: 'general', sling_size: 'M', sling_loops: 'green' });
  const { details, errors } = cleanDetails('mobility_transfers', mh.plan.details);
  assert.deepStrictEqual(errors, []);
  const texts = safetyFacts({ sections: [{ domain: 'mobility_transfers', details }] }).map(f => f.text);
  assert.ok(texts.includes('Transfers: Full (mobile or ceiling) hoist, 2 carers'), texts.join(' | '));
  assert.ok(texts.some(x => /^Sling: General purpose \/ full body size M \(green\)$/.test(x)), texts.join(' | '));
});
t('every tool\'s suggested details pass cleanDetails for its domain', () => {
  const samples = {
    waterlow: { build: 'average', sex: 'female', age: '81+', skin: ['dry'], continence: 'both', mobility: 'chairbound', lost_weight: 'no', eating_poorly: 'no', tissue: ['none'], neuro: 'none', surgery: 'none', medication: 'no' },
    must: { bmi_band: 'under18.5', loss_band: 'over10', acute: 'no' },
    falls: { history: 'yes', history_actions: ['pattern'], fear: 'no', mobility: 'yes', mobility_actions: ['supervise'], medicines: 'no', postural: 'no', cognition: 'no', continence: 'no', vision: 'no', feet: 'no', conditions: 'no', environment: 'no', injury: 'no' },
    bed_rails: { fall_from_bed: 'yes', gets_out: 'no', confused: 'no', atypical: 'no', involuntary: 'no', wishes: 'cannot_say', capacity: 'no_bi', alternatives: ['low_bed'], decision: 'no_rails' },
    eating_drinking: { signs: ['cough'], salt: 'current', food_level: '5', drink_level: '2', level_source: 'salt', choking: ['none'], support: 'full', fluid_target: 1500 },
    oral_health: { lips: '0', tongue: '0', gums: '0', saliva: '0', teeth: 'na', dentures: '0', cleanliness: '0', pain: '0', brushing: 'full', denture_type: 'both', denture_marked: 'yes', dentist: 'yes', refuses: 'no', last_visit: '2026-01-10' },
    peep: { floor: 'first', hears: 'yes', understands: 'yes', day: 'one', night: 'bed', equipment: ['evac_mattress'], route: 'West stairs' },
    abbey_pain: { vocalisation: '0', facial: '0', body_language: '0', behaviour: '0', physiological: '0', physical: '0' },
    delirium_4at: { alertness: '0', amt4: '0', months: '0', acute: '0' },
    mood_gds15: { able: 'no' },
    behaviour_support: { signs: ['shouting'], early: 'Pacing', triggers: ['noise'], physical_check: 'yes', prevent: 'Quiet lounge', calm: 'Music', psychotropic: 'no', restrictive: ['none'], abc: 'no' },
    leaving_building: { goes_out: 'no', attempts: 'occasionally', road: 'some', finds_way: 'no', capacity: 'no_bi', dols: 'granted', measures: ['herbert'] },
    hydration: { factors: ['help'], restriction: 'yes', restriction_ml: 1200, target_ml: 1200 },
    self_medication: { wants: 'some', capacity: 'yes', read: 'yes', open: 'yes', know: 'yes', remember: 'yes', storage: 'yes', others: 'no', cd: 'no', level: 'partial', which: 'Inhalers', check: 'Ask daily' },
    personal_fire: { smokes: 'cigarettes', smoke_safely: 'supervise', emollients: 'some', oxygen: 'no', airflow: 'no', items: ['none'], react: 'yes', detector: 'yes', controls: ['supervised', 'apron'] },
    wheelchair_belt: { use: 'pushed', source: 'nhs', checked: 'yes', cushion: 'yes', upright: 'yes', slides: 'no', belt: 'pelvic', belt_reason: 'posture', belt_assessed: 'yes', consent: 'yes' },
    bowel: { usual: 'daily', usual_type: '4', days_since: 4, factors: ['opioids'], signs: ['none'], laxatives: 'regular' },
    seizure: { diagnosis: 'epilepsy', looks: 'Jerks', frequency: 'Monthly', rescue: 'midazolam', rescue_when: 'After 5 min', protocol: 'yes', trained: 'yes', bathing: 'shower', night: 'checks' },
    catheter: { type: 'suprapubic', size: 16, balloon: 10, reason: 'Retention', change_due: '2099-01-01', drainage: 'valve', who_changes: 'district', still_needed: 'yes' },
    emotional_safety: { what: 'Wishes she was not here', level: 'passive', history: 'no', told: ['nurse'], support: 'Talk with her' },
  };
  for (const [k, a] of Object.entries(samples)) {
    const r = A.evaluate(k, a);
    assert.deepStrictEqual(r.errors, [], k);
    const { errors } = cleanDetails(r.plan.domain, r.plan.details || {});
    assert.deepStrictEqual(errors, [], `${k}: ${errors.join('; ')}`);
    const unknown = Object.keys(r.plan.details || {}).filter(key => !DOMAIN_DETAILS[r.plan.domain].some(f => f.key === key));
    assert.deepStrictEqual(unknown, [], `${k} proposes details its domain does not have`);
  }
});
t('v89 facts: fluid restriction is red; self-administered medicines and seizure plans show to carers', () => {
  const f = safetyFacts({ sections: [
    { domain: 'nutrition_hydration', details: { fluidRestrictionMl: 1200 } },
    { domain: 'medication', details: { selfAdmin: 'partial', selfAdminMeds: 'Inhalers' } },
    { domain: 'safety_risk', details: { seizurePlan: true, rescueMedicine: 'Buccal midazolam' } },
  ] });
  assert.ok(f.some(x => x.text === 'Fluid restriction: no more than 1200 ml a day' && x.tone === 'red'));
  assert.ok(f.some(x => /Self-administers: Inhalers/.test(x.text)));
  assert.ok(f.some(x => /rescue medicine: Buccal midazolam/.test(x.text)));
  assert.deepStrictEqual(safetyFacts({ sections: [{ domain: 'medication', details: { selfAdmin: 'staff', selfAdminMeds: 'x' } }] }), []);
});
t('detailValue prints readable values', () => {
  const f = DOMAIN_DETAILS.nutrition_hydration.find(x => x.key === 'fluidTargetMl');
  assert.strictEqual(detailValue(f, 1500), '1500 ml');
  assert.strictEqual(detailValue(DOMAIN_DETAILS.nutrition_hydration.find(x => x.key === 'iddsiFood'), '4'), 'Level 4 — Pureed');
});
console.log(`\ncare details: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
