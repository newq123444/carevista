// Tests for the Mental Capacity Act assessment engine.
//
// Each test is a situation a real assessor gets into. Several are about the
// engine REFUSING things — a conclusion the evidence does not support, a global
// "lacks capacity", a deprivation of liberty with no authorisation — because
// that is where an assessment tool earns its keep.
import assert from 'node:assert';
const { validateMca, deriveOutcome, normalise, emptyRecord } = await import('./mca.impl.mjs');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}
const NOW = new Date(2026, 9, 9, 12);
const v = (rec) => validateMca(rec, { now: NOW });
const errs = (rec, step) => v(rec).issues.filter(i => i.level === 'error' && (!step || i.step === step));
const has = (rec, level, re) => v(rec).issues.some(i => i.level === level && re.test(i.message + ' ' + i.law));

// ── A well-made "has capacity" assessment ─────────────────────────────────
function capable() {
  const r = emptyRecord('Whether to have the flu vaccination this autumn', 'medical_treatment');
  r.relevantInformation = ['What the vaccine is and what it protects against',
    'Common side effects such as a sore arm', 'The risk of flu if they decline'];
  r.reasonForDoubt = 'She told staff yesterday she had already had it, which records show she has not.';
  r.practicableSteps = ['Explained in the morning when she is brightest', 'Used the NHS easy-read leaflet'];
  r.assessedAt = '2026-10-09T10:15';
  r.functional = {
    understand:  { result: 'able', evidence: 'Explained back that it stops her catching flu.' },
    retain:      { result: 'able', evidence: 'Still remembered 20 minutes later.' },
    weigh:       { result: 'able', evidence: 'Said the sore arm was worth it to avoid being ill.' },
    communicate: { result: 'able', evidence: 'Said clearly "yes, I want it".' },
  };
  r.conclusion = { outcome: 'has_capacity', reasoning: 'She understood, retained and weighed the information and gave a clear decision.', furtherAssessment: '' };
  return r;
}

// ── A well-made "lacks capacity" assessment about where someone lives ─────
function lacking() {
  const r = emptyRecord('Whether Mr A should move from the residential floor to the nursing floor', 'accommodation');
  r.relevantInformation = ['Why the move is being suggested (two falls and a pressure sore)',
    'What the nursing floor is like and who would care for him',
    'What would happen if he stayed where he is — the risk of further falls'];
  r.reasonForDoubt = 'He has asked several times this week when his late wife is coming to collect him, and could not recall the falls.';
  r.practicableSteps = ['Visited the nursing floor together', 'His son was present', 'Spoke in short sentences with pauses'];
  r.assessedAt = '2026-10-09T10:00';
  r.functional = {
    understand:  { result: 'unable', evidence: 'After explanation he said "I have never fallen" and did not take in why the move was proposed.' },
    retain:      { result: 'unable', evidence: 'Five minutes later he had no recollection of the visit to the nursing floor.' },
    weigh:       { result: 'unable', evidence: 'Could not consider the risk of falling at all because he did not accept that falls had happened.' },
    communicate: { result: 'able',   evidence: 'Expressed himself clearly in words.' },
  };
  r.impairment = { present: true, description: 'Diagnosed vascular dementia, confirmed by the memory clinic in 2024.' };
  r.causativeNexus = { present: true, explanation: 'His memory loss from the dementia is why he cannot retain or weigh what has happened.' };
  r.conclusion = { outcome: 'lacks_capacity', reasoning: 'On the balance of probabilities he cannot understand, retain or weigh the relevant information because of his dementia.', furtherAssessment: '' };
  const bi = r.bestInterests;
  bi.decisionMaker = 'staff';
  bi.lpa = { exists: 'no', type: '', registerChecked: false, attorneyName: '', coversDecision: null };
  bi.deputy = { exists: 'no', name: '', coversDecision: null };
  bi.regainCapacity = { likely: 'no', canWait: null, notes: 'Progressive condition.' };
  bi.participation = 'He visited the nursing floor and was asked what he thought; he liked the garden view.';
  bi.wishesFeelings = 'He has always said he wants to be near the garden and to see his son often.';
  bi.beliefsValues = 'Attends the Sunday service; values his independence.';
  bi.consultees = [{ name: 'David A', relationship: 'Son', view: 'Supports the move if he keeps the garden view.' }];
  bi.options = [
    { option: 'Stay on the residential floor with a falls sensor', benefits: 'Familiar', burdens: 'Falls risk remains', restrictiveness: 'least' },
    { option: 'Move to a garden-view room on the nursing floor', benefits: 'Nursing care on hand', burdens: 'Unfamiliar staff at first', restrictiveness: 'more' },
  ];
  bi.chosenOption = 'Move to a garden-view room on the nursing floor';
  bi.whyLeastRestrictive = 'A sensor alone has not prevented falls; this keeps his garden view and his routine.';
  bi.notBasedOnAgeOrAppearance = true;
  r.liberty = { continuousSupervision: 'yes', notFreeToLeave: 'yes', authorisation: 'applied', notes: 'DoLS application sent 9 Oct.' };
  r.reviewDate = '2027-01-09';
  return r;
}

// ── The two good records pass ─────────────────────────────────────────────
t('a well-made "has capacity" record can be completed', () => {
  const out = v(capable());
  assert.deepStrictEqual(errs(capable()), [], JSON.stringify(errs(capable()), null, 1));
  assert.strictEqual(out.canComplete, true);
  assert.strictEqual(out.derivedOutcome, 'has_capacity');
  assert.strictEqual(out.steps.best_interests, 'not_needed');
  assert.strictEqual(out.steps.liberty, 'not_needed');
});
t('a well-made "lacks capacity" record can be completed', () => {
  const e = errs(lacking());
  assert.deepStrictEqual(e, [], JSON.stringify(e, null, 1));
  const out = v(lacking());
  assert.strictEqual(out.derivedOutcome, 'lacks_capacity');
  assert.strictEqual(out.deprivationOfLiberty, true);
  assert.strictEqual(out.steps.best_interests, 'complete');
});
t('an empty record cannot be completed', () => {
  const out = v(emptyRecord());
  assert.strictEqual(out.canComplete, false);
  assert.ok(out.issues.filter(i => i.level === 'error').length >= 5);
});

// ── Decision-specific (s2(1)) ─────────────────────────────────────────────
t('a global "lacks capacity" decision is refused', () => {
  for (const d of ['Lacks capacity for all decisions', 'Her capacity in general', 'Everything about her care']) {
    const r = capable(); r.decision = d;
    assert.ok(errs(r, 'decision').some(i => /one decision/.test(i.message)), d);
  }
});
t('relevant information should include consequences', () => {
  const r = capable(); r.relevantInformation = ['What the vaccine is'];
  assert.ok(has(r, 'warning', /consequences/));
});

// ── Presumption, and s2(3) ────────────────────────────────────────────────
t('no reason to doubt capacity is an error — capacity is presumed', () => {
  const r = capable(); r.reasonForDoubt = '';
  assert.ok(errs(r, 'decision').some(i => /s1\(2\)/.test(i.law)));
});
t('a diagnosis alone is not a reason', () => {
  const r = capable(); r.reasonForDoubt = 'She has a diagnosis of dementia.';
  assert.ok(has(r, 'warning', /s2\(3\)/));
});
t('a diagnosis plus what they actually said is fine', () => {
  const r = capable(); r.reasonForDoubt = 'She has dementia and told staff she had already had the vaccine.';
  assert.ok(!has(r, 'warning', /s2\(3\)/));
});

// ── Practicable steps (s1(3)) ─────────────────────────────────────────────
t('concluding incapacity without trying to help is refused', () => {
  const r = lacking(); r.practicableSteps = [];
  assert.ok(errs(r, 'support').some(i => /s1\(3\)/.test(i.law)));
});
t('for someone with capacity, missing support steps is only a warning', () => {
  const r = capable(); r.practicableSteps = [];
  assert.ok(!errs(r, 'support').some(i => /s1\(3\)/.test(i.law)));
  assert.ok(has(r, 'warning', /s1\(3\)/));
});

// ── The functional test ───────────────────────────────────────────────────
t('an inability needs evidence in the person\'s words', () => {
  const r = lacking(); r.functional.understand.evidence = 'No.';
  assert.ok(errs(r, 'test').some(i => /s3\(1\)\(a\)/.test(i.law)));
});
t('an unwise decision is flagged as not proof of inability', () => {
  const r = lacking(); r.functional.weigh.evidence = 'He made an unwise decision against medical advice to stay put.';
  assert.ok(has(r, 'warning', /s1\(4\)/));
});
t('"cannot communicate" must show other ways were tried', () => {
  const r = lacking();
  r.functional.communicate = { result: 'unable', evidence: 'He did not answer any of my questions at all today.' };
  assert.ok(has(r, 'warning', /ANY means/));
  r.functional.communicate.evidence = 'Tried picture cards, writing and asked him to blink yes; no consistent response.';
  assert.ok(!has(r, 'warning', /ANY means/));
});
t('retaining for a short time is enough', () => {
  const r = lacking(); r.functional.retain.evidence = 'He only remembered it for a short time, a few minutes at most.';
  assert.ok(has(r, 'warning', /s3\(3\)/));
});
t('if no limb is unable, every limb must be assessed', () => {
  const r = capable(); r.functional.retain = { result: 'not_assessed', evidence: '' };
  assert.ok(errs(r, 'test').some(i => /s3\(1\)\(b\)/.test(i.law)));
});

// ── Diagnostic stage and the causal link (JB) ─────────────────────────────
t('an inability needs an impairment to be recorded', () => {
  const r = lacking(); r.impairment = { present: null, description: '' };
  assert.ok(errs(r, 'test').some(i => /s2\(1\)/.test(i.law)));
});
t('the causal link must be shown, not assumed', () => {
  const r = lacking(); r.causativeNexus = { present: null, explanation: '' };
  assert.ok(errs(r, 'test').some(i => /JB/.test(i.law)));
});
t('unable but NOT because of an impairment means they have capacity under the Act', () => {
  const r = lacking(); r.causativeNexus = { present: false, explanation: '' };
  assert.strictEqual(deriveOutcome(normalise(r)), 'has_capacity');
  assert.ok(errs(r, 'outcome').some(i => /does not support a finding that they lack/.test(i.message)),
    'concluding "lacks" must be refused');
  assert.ok(has(r, 'info', /safeguarding/));
});
t('no impairment at all also means capacity under the Act', () => {
  const r = lacking(); r.impairment = { present: false, description: '' };
  assert.strictEqual(deriveOutcome(normalise(r)), 'has_capacity');
});

// ── The conclusion must follow from the evidence ──────────────────────────
t('concluding "lacks capacity" when every limb is "able" is refused', () => {
  const r = capable(); r.conclusion.outcome = 'lacks_capacity';
  assert.ok(errs(r, 'outcome').length > 0);
});
t('concluding "has capacity" when the evidence shows incapacity is refused', () => {
  const r = lacking(); r.conclusion.outcome = 'has_capacity';
  assert.ok(errs(r, 'outcome').some(i => /supports a finding that they lack/.test(i.message)));
});
t('"cannot determine" needs a plan and keeps the presumption', () => {
  const r = emptyRecord('Whether to sign the new tenancy agreement for the flat', 'finance');
  r.relevantInformation = ['What the agreement commits her to and what happens if she does not sign'];
  r.reasonForDoubt = 'She asked staff three times who the landlord was.';
  r.assessedAt = '2026-10-09T09:00';
  r.functional.understand = { result: 'unable', evidence: 'Could not say what the agreement was for after it was explained.' };
  r.conclusion = { outcome: 'cannot_determine', reasoning: 'She was unwell with a chest infection today and may have delirium.', furtherAssessment: '' };
  r.reviewDate = '2026-10-23';
  assert.ok(errs(r, 'outcome').some(i => /who will assess further/.test(i.message)));
  assert.ok(has(r, 'info', /presumed/));
  r.conclusion.furtherAssessment = 'GP to review delirium; reassess when infection treated.';
  assert.ok(!errs(r, 'outcome').some(i => /who will assess further/.test(i.message)));
});
t('fluctuating capacity with incapacity needs a reassessment date', () => {
  const r = lacking(); r.fluctuating = true; r.bestTimeConsidered = true; r.reassessBy = null;
  assert.ok(errs(r, 'outcome').some(i => /reassessed/.test(i.message)));
});

// ── Best interests (s4) ───────────────────────────────────────────────────
t('best interests is only asked when they lack capacity', () => {
  assert.strictEqual(v(capable()).steps.best_interests, 'not_needed');
  assert.ok(!errs(capable()).some(i => i.step === 'best_interests'));
});
t('a health and welfare attorney who covers the decision makes it, not the home', () => {
  const r = lacking();
  r.bestInterests.lpa = { exists: 'yes', type: 'health_welfare', registerChecked: true, attorneyName: 'David A', coversDecision: true };
  assert.ok(errs(r, 'best_interests').some(i => /attorney/.test(i.message)));
  r.bestInterests.decisionMaker = 'lpa_attorney';
  assert.ok(!errs(r, 'best_interests').some(i => /attorney/.test(i.message)));
});
t('a property and finance LPA does not cover a care decision', () => {
  const r = lacking();
  r.bestInterests.lpa = { exists: 'yes', type: 'property_financial', registerChecked: true, attorneyName: 'David A', coversDecision: true };
  assert.ok(!errs(r, 'best_interests').some(i => /attorney/.test(i.message)));
  assert.ok(has(r, 'info', /does not cover/));
});
t('an unknown LPA prompts a check of the OPG register', () => {
  const r = lacking(); r.bestInterests.lpa.exists = 'unknown';
  assert.ok(has(r, 'warning', /Public Guardian/));
});
t('a valid and applicable advance decision must be followed', () => {
  const r = lacking(); r.category = 'medical_treatment';
  r.liberty = { continuousSupervision: '', notFreeToLeave: '', authorisation: '', notes: '' };
  r.bestInterests.adrt = { exists: 'yes', validAndApplicable: true, details: '' };
  assert.ok(errs(r, 'best_interests').some(i => /s26/.test(i.law)));
});
t('treatment decisions must check for an advance decision', () => {
  const r = lacking(); r.category = 'medication';
  assert.ok(errs(r, 'best_interests').some(i => /ss24–26/.test(i.law)));
});
t('their wishes, feelings, beliefs and values are required', () => {
  const r = lacking(); r.bestInterests.wishesFeelings = ''; r.bestInterests.beliefsValues = '';
  const e = errs(r, 'best_interests');
  assert.ok(e.some(i => /s4\(6\)\(a\)/.test(i.law)));
  assert.ok(e.some(i => /s4\(6\)\(b\)/.test(i.law)));
});
t('consultation is required, and each consultee needs their view', () => {
  const r = lacking(); r.bestInterests.consultees = [];
  assert.ok(errs(r, 'best_interests').some(i => /s4\(7\)/.test(i.law)));
  r.bestInterests.consultees = [{ name: 'Jo', relationship: '', view: '' }];
  assert.ok(errs(r, 'best_interests').some(i => /For Jo/.test(i.message)));
});
t('nobody to consult on a move means an IMCA must be instructed', () => {
  const r = lacking(); r.bestInterests.consultees = []; r.bestInterests.noOneAppropriateToConsult = true;
  assert.ok(errs(r, 'best_interests').some(i => /ss37–39/.test(i.law)));
  r.bestInterests.imca = { referred: true, name: 'POhWER advocate' };
  assert.ok(!errs(r, 'best_interests').some(i => /ss37–39/.test(i.law)));
});
t('an IMCA is not demanded where the Act does not require one', () => {
  const r = lacking(); r.category = 'contact';
  r.bestInterests.consultees = []; r.bestInterests.noOneAppropriateToConsult = true;
  assert.ok(!errs(r, 'best_interests').some(i => /ss37–39/.test(i.law)));
});
t('covert medication needs the prescriber and a pharmacist', () => {
  const r = lacking(); r.category = 'covert_medication';
  r.bestInterests.adrt = { exists: 'no', validAndApplicable: null, details: '' };
  const e = errs(r, 'best_interests');
  assert.ok(e.some(i => /prescriber/.test(i.message)));
  assert.ok(e.some(i => /pharmacist/.test(i.message)));
  r.bestInterests.consultees.push({ name: 'Dr Shah', relationship: 'GP', view: 'Agrees, crush in yoghurt.' });
  r.bestInterests.consultees.push({ name: 'Amy', relationship: 'Pharmacist', view: 'Safe to crush both.' });
  assert.ok(!errs(r, 'best_interests').some(i => /prescriber|pharmacist/.test(i.message)));
});
t('at least two options, and the least restrictive reasoning', () => {
  const r = lacking(); r.bestInterests.options = [r.bestInterests.options[0]]; r.bestInterests.whyLeastRestrictive = '';
  const e = errs(r, 'best_interests');
  assert.ok(e.some(i => /at least two/.test(i.message)));
  assert.ok(e.some(i => /least restrictive way/.test(i.message)));
});
t('the s4(1) confirmation is required', () => {
  const r = lacking(); r.bestInterests.notBasedOnAgeOrAppearance = false;
  assert.ok(errs(r, 'best_interests').some(i => /s4\(1\)/.test(i.law)));
});
t('life-sustaining treatment needs the s4(5) confirmation', () => {
  const r = lacking(); r.bestInterests.lifeSustaining = true;
  assert.ok(errs(r, 'best_interests').some(i => /s4\(5\)/.test(i.law)));
  r.bestInterests.notMotivatedByDeath = true;
  assert.ok(!errs(r, 'best_interests').some(i => /s4\(5\)/.test(i.law)));
});
t('waiting for capacity to return is suggested when possible', () => {
  const r = lacking(); r.bestInterests.regainCapacity = { likely: 'yes', canWait: true, notes: '' };
  assert.ok(has(r, 'warning', /s4\(3\)/));
});

// ── Liberty (DoLS) ────────────────────────────────────────────────────────
t('a deprivation of liberty without authorisation is refused', () => {
  const r = lacking(); r.liberty.authorisation = 'needed';
  assert.ok(errs(r, 'liberty').some(i => /Schedule A1/.test(i.law)));
  r.liberty.authorisation = '';
  assert.ok(errs(r, 'liberty').some(i => /Schedule A1/.test(i.law)));
});
t('applied for or granted is enough to complete', () => {
  for (const a of ['applied', 'granted']) {
    const r = lacking(); r.liberty.authorisation = a;
    assert.deepStrictEqual(errs(r, 'liberty'), [], a);
  }
});
t('not continuously supervised means no DoLS needed', () => {
  const r = lacking(); r.liberty = { continuousSupervision: 'no', notFreeToLeave: 'yes', authorisation: '', notes: '' };
  assert.deepStrictEqual(errs(r, 'liberty'), []);
  assert.strictEqual(v(r).deprivationOfLiberty, false);
});
t('unsure prompts advice from the DoLS team', () => {
  const r = lacking(); r.liberty = { continuousSupervision: 'unknown', notFreeToLeave: 'yes', authorisation: '', notes: '' };
  assert.ok(has(r, 'warning', /DoLS team/));
});
t('liberty is not asked about money', () => {
  const r = lacking(); r.category = 'finance';
  assert.strictEqual(v(r).steps.liberty, 'not_needed');
});

// ── Review ────────────────────────────────────────────────────────────────
t('a lacks-capacity finding needs a review date', () => {
  const r = lacking(); r.reviewDate = null;
  assert.ok(errs(r, 'review').length > 0);
});
t('a review date in the past is refused', () => {
  const r = lacking(); r.reviewDate = '2026-01-01';
  assert.ok(errs(r, 'review').some(i => /past/.test(i.message)));
});
t('a review more than a year away is questioned', () => {
  const r = lacking(); r.reviewDate = '2028-01-01';
  assert.ok(has(r, 'warning', /more than a year/));
});

// ── Robustness ────────────────────────────────────────────────────────────
t('partial and malformed input does not crash', () => {
  for (const x of [null, undefined, {}, { functional: null }, { bestInterests: { consultees: 'x' } }, 'nonsense', 42]) {
    const out = validateMca(x, { now: NOW });
    assert.strictEqual(out.canComplete, false);
  }
});
t('unknown fields are dropped and types are kept honest', () => {
  const r = normalise({ decision: 123, sneaky: 'x', fluctuating: 'yes', category: 'made_up' });
  assert.strictEqual(r.decision, '123');
  assert.strictEqual(r.sneaky, undefined);
  assert.strictEqual(r.fluctuating, false);
  assert.strictEqual(r.category, 'other');
});
t('every issue cites its source and reads as a sentence', () => {
  const out = v(emptyRecord('x'));
  const all = [...out.issues, ...v(lacking()).issues, ...v(capable()).issues];
  for (const i of all) {
    assert.ok(i.law && i.law.length > 3, `no citation: ${i.message}`);
    assert.ok(/[.?]$/.test(i.message), `not a sentence: ${i.message}`);
  }
});

console.log(`\nmental capacity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
