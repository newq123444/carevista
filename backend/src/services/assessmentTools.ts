// ────────────────────────────────────────────────────────────────────────────
// Clinical assessment tools — one definition, used by the server and the app.
//
// THE CANONICAL COPY IS backend/src/services/assessmentTools.ts. The app's copy
// at frontend/src/shared/assessmentTools.ts is generated from it by
// `node scripts/sync-shared.mjs`, and `npm run check` fails if they differ.
// The app scores as the nurse answers; the server scores again on save and
// stores ITS result, so a tampered or out-of-date app cannot change a score.
//
// Every tool is data (questions, options, points) plus one evaluate() that
// turns answers into: a score where the tool has one, a level, the reasons,
// what to do now, warnings, when to review, what the care plan should say,
// and the few "know before you help" facts carers see on the resident.
//
// What this does NOT do is decide care. Each tool supports a trained person's
// judgement. In particular:
//   • Falls has NO score. NICE NG249 (2025) recommends not using falls risk
//     prediction tools; it asks for a multifactorial assessment with an
//     action against each factor found. That is what the falls tool is.
//   • Waterlow is answered by the nurse, not filled in from old data.
//   • Choking/eating, bed rails, moving and handling and PEEP use transparent
//     rules (each reason is shown), not validated scores, and say so.
//
// Sources are on each tool. Pure (imports only its own core and the v89
// tools file). Tested in
// backend/tests/assessments.test.mjs.
// ────────────────────────────────────────────────────────────────────────────

import {
  YES_NO, str, list, num, allQuestions, missingAnswers, q, opt, points, labelsOf, uniq, timesEvery, base, bmiOf, lossPct,
  type ToolKey, type Level, type Answer, type Answers, type Option, type Question, type Section, type Context,
  type PlanSuggestion, type Result, type Tool,
} from './assessmentCore';
import { MORE_TOOLS } from './assessmentToolsMore';
export {
  missingAnswers, timesEvery, bmiOf, lossPct,
  type ToolKey, type Level, type Answer, type Answers, type Option, type Question, type Section, type Context,
  type PlanSuggestion, type Result, type Tool,
};

// ── 1. Waterlow ──────────────────────────────────────────────────────────────
// Waterlow (1985, revised 2005). Bands: 10+ at risk, 15+ high, 20+ very high.
// Actions follow NICE CG179 (pressure ulcers: prevention and management).

const waterlow: Tool = {
  key: 'waterlow', name: 'Waterlow pressure ulcer risk', shortName: 'Waterlow', version: 'waterlow-2005/cv88',
  purpose: 'How likely this person is to develop a pressure ulcer, and what to do about it.',
  who: 'A nurse or senior carer trained in pressure ulcer prevention. On admission (within 6 hours), then as the plan says, and whenever their health, mobility or continence changes.',
  domain: 'skin_integrity', scored: true,
  sources: [
    { label: 'Waterlow score card (Waterlow 1985, revised 2005)', url: 'https://www.judy-waterlow.co.uk/' },
    { label: 'NICE CG179 Pressure ulcers: prevention and management', url: 'https://www.nice.org.uk/guidance/cg179' },
  ],
  sections: [
    { key: 'person', title: 'About the person', questions: [
      { key: 'build', label: 'Build / weight for height', hint: 'Use their BMI if you have it.', type: 'choice', options: [
        { value: 'average', label: 'Average (BMI 20–24.9)', points: 0 },
        { value: 'above', label: 'Above average (BMI 25–29.9)', points: 1 },
        { value: 'obese', label: 'Obese (BMI 30 or more)', points: 2 },
        { value: 'below', label: 'Below average (BMI under 20)', points: 3 },
      ] },
      { key: 'sex', label: 'Sex', type: 'choice', options: [
        { value: 'male', label: 'Male', points: 1 }, { value: 'female', label: 'Female', points: 2 },
      ] },
      { key: 'age', label: 'Age', type: 'choice', options: [
        { value: '14-49', label: '14–49', points: 1 }, { value: '50-64', label: '50–64', points: 2 },
        { value: '65-74', label: '65–74', points: 3 }, { value: '75-80', label: '75–80', points: 4 },
        { value: '81+', label: '81 or over', points: 5 },
      ] },
    ] },
    { key: 'skin', title: 'Skin', intro: 'Look at their skin now, especially heels, sacrum, hips, elbows and ears. Choose everything you see.', questions: [
      { key: 'skin', label: 'Skin type in the areas at risk', type: 'multi', options: [
        { value: 'healthy', label: 'Healthy', points: 0, exclusive: true },
        { value: 'tissue_paper', label: 'Tissue paper (thin, fragile)', points: 1 },
        { value: 'dry', label: 'Dry', points: 1 },
        { value: 'oedematous', label: 'Oedematous (swollen)', points: 1 },
        { value: 'clammy', label: 'Clammy, or a temperature', points: 1 },
        { value: 'discoloured', label: 'Discoloured (category 1 — red, does not blanch)', points: 2 },
        { value: 'broken', label: 'Broken or spots (category 2–4)', points: 3 },
      ] },
    ] },
    { key: 'continence', title: 'Continence and mobility', questions: [
      { key: 'continence', label: 'Continence', type: 'choice', options: [
        { value: 'complete', label: 'Complete, or catheterised', points: 0 },
        { value: 'urine', label: 'Urinary incontinence', points: 1 },
        { value: 'faecal', label: 'Faecal incontinence', points: 2 },
        { value: 'both', label: 'Urinary and faecal incontinence', points: 3 },
      ] },
      { key: 'mobility', label: 'Mobility', type: 'choice', options: [
        { value: 'fully', label: 'Fully mobile', points: 0 },
        { value: 'restless', label: 'Restless, fidgety', points: 1 },
        { value: 'apathetic', label: 'Apathetic', points: 2 },
        { value: 'restricted', label: 'Restricted', points: 3 },
        { value: 'bedbound', label: 'Bedbound (e.g. traction)', points: 4 },
        { value: 'chairbound', label: 'Chairbound (e.g. wheelchair)', points: 5 },
      ] },
    ] },
    { key: 'nutrition', title: 'Nutrition', intro: 'The Waterlow nutrition screen. If it scores more than 2, complete a MUST.', questions: [
      { key: 'lost_weight', label: 'Have they lost weight recently?', type: 'choice', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No', points: 0 }, { value: 'unsure', label: 'Unsure', points: 2 },
      ] },
      { key: 'weight_lost', label: 'How much?', type: 'choice', showIf: a => a.lost_weight === 'yes', options: [
        { value: '0.5-5', label: '0.5–5 kg', points: 1 }, { value: '5-10', label: '5–10 kg', points: 2 },
        { value: '10-15', label: '10–15 kg', points: 3 }, { value: '15+', label: 'More than 15 kg', points: 4 },
        { value: 'unsure', label: 'Unsure', points: 2 },
      ] },
      { key: 'eating_poorly', label: 'Eating poorly or lack of appetite?', type: 'choice', options: [
        { value: 'no', label: 'No', points: 0 }, { value: 'yes', label: 'Yes', points: 1 },
      ] },
    ] },
    { key: 'special', title: 'Special risks', intro: 'Choose any that apply. Leave as "None" if none do.', questions: [
      { key: 'tissue', label: 'Tissue malnutrition', type: 'multi', options: [
        { value: 'none', label: 'None', points: 0, exclusive: true },
        { value: 'cachexia', label: 'Terminal cachexia', points: 8 },
        { value: 'multi_organ', label: 'Multiple organ failure', points: 8 },
        { value: 'single_organ', label: 'Single organ failure (respiratory, renal, cardiac)', points: 5 },
        { value: 'pvd', label: 'Peripheral vascular disease', points: 5 },
        { value: 'anaemia', label: 'Anaemia (Hb under 8)', points: 2 },
        { value: 'smoking', label: 'Smoking', points: 1 },
      ] },
      { key: 'neuro', label: 'Neurological deficit (diabetes, MS, stroke, motor or sensory loss, paraplegia)', hint: 'Score by how stable it is and how much it affects them.', type: 'choice', options: [
        { value: 'none', label: 'None', points: 0 }, { value: '4', label: 'Yes — mild impact', points: 4 },
        { value: '5', label: 'Yes — moderate impact', points: 5 }, { value: '6', label: 'Yes — severe impact', points: 6 },
      ] },
      { key: 'surgery', label: 'Major surgery or trauma (in the last 48 hours)', type: 'choice', options: [
        { value: 'none', label: 'None', points: 0 },
        { value: 'ortho', label: 'Orthopaedic (below the waist) or spinal', points: 5 },
        { value: 'table2', label: 'On the operating table more than 2 hours', points: 5 },
        { value: 'table6', label: 'On the operating table more than 6 hours', points: 8 },
      ] },
      { key: 'medication', label: 'Medicines: cytotoxics, long-term or high-dose steroids, anti-inflammatories', type: 'choice', options: [
        { value: 'no', label: 'No', points: 0 }, { value: 'yes', label: 'Yes', points: 4 },
      ] },
    ] },
  ],
  prefill(ctx) {
    const a: Answers = {};
    const bmi = bmiOf(ctx.weightKg, ctx.heightCm);
    if (bmi !== null) a.build = bmi >= 30 ? 'obese' : bmi >= 25 ? 'above' : bmi >= 20 ? 'average' : 'below';
    const s = (ctx.sex || '').toLowerCase();
    if (s.startsWith('m')) a.sex = 'male'; else if (s.startsWith('f') || s.startsWith('w')) a.sex = 'female';
    const age = ctx.ageYears;
    if (age !== null && age !== undefined && age >= 14) a.age = age >= 81 ? '81+' : age >= 75 ? '75-80' : age >= 65 ? '65-74' : age >= 50 ? '50-64' : '14-49';
    return a;
  },
  evaluate(a) {
    const t = waterlow;
    const r = base(t, a, t.domain);
    const skin = list(a.skin);
    if (skin.includes('healthy') && skin.length > 1) r.errors.push('Skin: "Healthy" cannot be chosen with other skin types.');
    const tissue = list(a.tissue);
    if (tissue.includes('none') && tissue.length > 1) r.errors.push('Tissue malnutrition: "None" cannot be chosen with other items.');

    let nutrition = 0;
    if (a.lost_weight === 'yes') nutrition += points(t, 'weight_lost', a);
    else nutrition += points(t, 'lost_weight', a);
    nutrition += points(t, 'eating_poorly', a);

    const parts: [string, number][] = [
      ['Build', points(t, 'build', a)], ['Sex', points(t, 'sex', a)], ['Age', points(t, 'age', a)],
      ['Skin', points(t, 'skin', a)], ['Continence', points(t, 'continence', a)], ['Mobility', points(t, 'mobility', a)],
      ['Nutrition', nutrition], ['Tissue malnutrition', points(t, 'tissue', a)], ['Neurological deficit', points(t, 'neuro', a)],
      ['Surgery or trauma', points(t, 'surgery', a)], ['Medicines', points(t, 'medication', a)],
    ];
    const total = parts.reduce((s, [, p]) => s + p, 0);
    r.score = total;
    r.storedScore = total;
    r.reasons = parts.filter(([, p]) => p > 0).map(([k, p]) => `${k}: ${p}`);

    const band = total >= 20 ? 'very_high' : total >= 15 ? 'high' : total >= 10 ? 'medium' : 'low';
    r.level = band;
    r.headline = band === 'very_high' ? `Very high risk (${total}; 20 or more)`
      : band === 'high' ? `High risk (${total}; 15–19)`
      : band === 'medium' ? `At risk (${total}; 10–14)` : `Not at risk on the score (${total}; under 10)`;

    const hours = band === 'low' ? 0 : band === 'medium' ? 6 : 4;
    if (band === 'low') {
      r.actions.push('Routine care. Look at their skin during personal care and report any redness that does not fade.');
    } else {
      r.actions.push(`Help them change position at least every ${hours} hours, day and night, if they cannot do it themselves (NICE CG179).`);
      r.actions.push('Check pressure areas at each change of position and during personal care. Report redness that does not fade when pressed.');
      r.actions.push('Do not massage or rub pressure areas.');
      r.actions.push('Keep skin clean and dry. Use a barrier product if they are incontinent.');
    }
    if (band === 'medium') r.actions.push('If they sit for long periods, consider a pressure-redistributing cushion.');
    if (band === 'high' || band === 'very_high') {
      r.actions.push('Use a high-specification foam mattress (NICE CG179), and a high-specification foam cushion if they sit for long periods.');
      r.actions.push('Keep heels off the mattress (pillow under the calves or a heel-offloading device).');
    }
    if (band === 'very_high') r.actions.push('Ask the district nurse or tissue viability team to review their pressure-relieving equipment.');
    if (nutrition > 2) r.actions.push(`Nutrition scored ${nutrition}: complete a MUST and refer for a nutrition assessment.`);
    if (skin.includes('broken')) {
      r.warnings.push('Broken skin recorded. Complete a wound assessment, tell the nurse in charge, and follow the home\'s policy for reporting pressure ulcers.');
    }
    if (skin.includes('discoloured')) r.actions.push('Category 1 damage: relieve pressure from that area completely and re-check it within 2 hours.');

    r.reviewDays = band === 'low' ? 28 : 7;
    r.reviewNote = 'And straight away if their health, mobility, continence or nutrition changes, after a hospital stay, or after surgery.';

    const p = r.plan;
    p.riskLevel = band === 'low' ? 'low' : band === 'medium' ? 'medium' : 'high';
    const bandWords = { low: 'not at risk on the score', medium: 'at risk', high: 'high risk', very_high: 'very high risk' }[band];
    p.need = `Waterlow ${total} (${bandWords}) of developing pressure damage.${r.reasons.length ? ' Contributing: ' + r.reasons.join(', ') + '.' : ''}`;
    p.outcome = 'Skin stays intact; any change is found early and acted on.';
    p.interventions = r.actions.filter(x => !x.startsWith('Nutrition scored'));
    if (band === 'high' || band === 'very_high') p.equipment = ['High-specification foam mattress', 'High-specification foam cushion'];
    else if (band === 'medium') p.equipment = ['Pressure-redistributing cushion (if sitting for long periods)'];
    if (hours) {
      p.details = { repositionHours: hours, ...(band === 'high' || band === 'very_high' ? { mattress: 'High-specification foam' } : {}) };
      // Round the clock: NICE says day and night. The nurse picks which to keep.
      p.schedule = timesEvery(hours, hours === 4 ? '02:00' : '00:00', '23:59').map(time => ({ time, what: 'Change position and check pressure areas' }));
      r.facts.push(`Pressure care: change position at least every ${hours} hours`);
    }
    return r;
  },
};

// ── 2. MUST ──────────────────────────────────────────────────────────────────
// BAPEN 'Malnutrition Universal Screening Tool'. Steps 1–3 add up; 0 low,
// 1 medium, 2+ high. Management for care homes from the BAPEN flow chart.

const must: Tool = {
  key: 'must', name: 'MUST — malnutrition screening', shortName: 'MUST', version: 'must-bapen-2011/cv88',
  purpose: 'Whether this person is malnourished or at risk, and the nutrition plan that follows.',
  who: 'A trained nurse or senior carer. On admission, then monthly; more often if they are at risk or unwell.',
  domain: 'nutrition_hydration', scored: true,
  sources: [
    { label: 'BAPEN — the MUST toolkit', url: 'https://www.bapen.org.uk/must-and-self-screening/must-toolkit/' },
    { label: 'MDCalc — MUST (summary of BAPEN guidance)', url: 'https://www.mdcalc.com/calc/10190/malnutrition-universal-screening-tool-must' },
  ],
  sections: [
    { key: 'step1', title: 'Step 1 — BMI', intro: 'Weigh them on calibrated scales. If they cannot be weighed or measured, use mid upper arm circumference (MUAC) or a recalled height, and choose the band that fits best.', questions: [
      { key: 'weight_kg', label: 'Weight today', type: 'number', unit: 'kg', min: 20, max: 300, optional: true },
      { key: 'height_cm', label: 'Height', type: 'number', unit: 'cm', min: 100, max: 230, optional: true },
      { key: 'bmi_band', label: 'BMI band', hint: 'MUAC under 23.5 cm suggests a BMI under 20; over 32 cm suggests over 30.', type: 'choice', options: [
        { value: 'over20', label: 'Over 20 (over 30 is obese)', points: 0 },
        { value: '18.5-20', label: '18.5 to 20', points: 1 },
        { value: 'under18.5', label: 'Under 18.5', points: 2 },
      ] },
    ] },
    { key: 'step2', title: 'Step 2 — weight loss', intro: 'Unplanned weight loss in the past 3–6 months. If you have no weights, use clothes, rings or dentures becoming loose.', questions: [
      { key: 'past_weight_kg', label: 'Weight 3–6 months ago (if known)', type: 'number', unit: 'kg', min: 20, max: 300, optional: true },
      { key: 'loss_band', label: 'Unplanned weight loss', type: 'choice', options: [
        { value: 'under5', label: 'Less than 5%', points: 0 },
        { value: '5-10', label: '5–10%', points: 1 },
        { value: 'over10', label: 'More than 10%', points: 2 },
      ] },
    ] },
    { key: 'step3', title: 'Step 3 — acute illness', questions: [
      { key: 'acute', label: 'Are they acutely ill AND have had, or are likely to have, no nutritional intake for more than 5 days?', type: 'choice', options: [
        { value: 'no', label: 'No', points: 0 }, { value: 'yes', label: 'Yes', points: 2 },
      ] },
    ] },
  ],
  prefill(ctx) {
    const a: Answers = {};
    if (ctx.weightKg) a.weight_kg = ctx.weightKg;
    if (ctx.heightCm) a.height_cm = ctx.heightCm;
    if (ctx.pastWeightKg) a.past_weight_kg = ctx.pastWeightKg;
    const bmi = bmiOf(ctx.weightKg, ctx.heightCm);
    if (bmi !== null) a.bmi_band = bmi > 20 ? 'over20' : bmi >= 18.5 ? '18.5-20' : 'under18.5';
    const loss = lossPct(ctx.weightKg, ctx.pastWeightKg);
    if (loss !== null) a.loss_band = loss > 10 ? 'over10' : loss >= 5 ? '5-10' : 'under5';
    return a;
  },
  evaluate(a) {
    const t = must;
    const r = base(t, a, t.domain);
    const bmi = bmiOf(num(a.weight_kg), num(a.height_cm));
    if (bmi !== null) {
      const band = bmi > 20 ? 'over20' : bmi >= 18.5 ? '18.5-20' : 'under18.5';
      r.reasons.push(`BMI ${bmi} from ${num(a.weight_kg)} kg and ${num(a.height_cm)} cm`);
      if (str(a.bmi_band) && a.bmi_band !== band) r.warnings.push(`The weight and height give a BMI of ${bmi}, which is in a different band from the one chosen. Check the band, or the measurements.`);
    }
    const loss = lossPct(num(a.weight_kg), num(a.past_weight_kg));
    if (loss !== null) {
      const band = loss > 10 ? 'over10' : loss >= 5 ? '5-10' : 'under5';
      r.reasons.push(loss >= 0 ? `Weight loss ${loss}% (from ${num(a.past_weight_kg)} kg)` : `Weight gain ${-loss}%`);
      if (str(a.loss_band) && a.loss_band !== band) r.warnings.push(`The two weights give ${loss}% loss, which is in a different band from the one chosen. Check it.`);
    }
    const s1 = points(t, 'bmi_band', a), s2 = points(t, 'loss_band', a), s3 = points(t, 'acute', a);
    const total = s1 + s2 + s3;
    r.score = total; r.storedScore = total; r.maxScore = 6;
    r.reasons.push(`Step 1 (BMI): ${s1}`, `Step 2 (weight loss): ${s2}`, `Step 3 (acute illness): ${s3}`);
    const level = total >= 2 ? 'high' : total === 1 ? 'medium' : 'low';
    r.level = level;
    r.headline = level === 'high' ? `High risk of malnutrition (MUST ${total})` : level === 'medium' ? 'Medium risk of malnutrition (MUST 1)' : 'Low risk of malnutrition (MUST 0)';
    if (bmi !== null && bmi > 30) r.actions.push('BMI over 30: record obesity. Treat any acute illness first; do not start weight reduction while they are unwell.');

    if (level === 'low') {
      r.actions.push('Routine care. Repeat the screen monthly (BAPEN, care homes).');
    } else if (level === 'medium') {
      r.actions.push('Observe: record everything they eat and drink for 3 days.');
      r.actions.push('If they ate enough and there is little concern, repeat the screen at least monthly.');
      r.actions.push('If they did not eat enough, or staff are concerned: follow the home\'s nutrition policy — set a goal, improve and increase what they eat, and review the plan regularly.');
    } else {
      r.actions.push('Treat: refer to a dietitian (usually through the GP), or follow the home\'s malnutrition pathway.');
      r.actions.push('Food first: fortify meals and offer nourishing snacks and drinks between meals.');
      r.actions.push('Set a goal with them, e.g. to stop losing weight, and monitor it.');
      r.actions.push('Monitor and review the nutrition plan at least monthly (BAPEN); weigh weekly while high risk if the home\'s policy says so.');
      if (s3 === 2) r.actions.push('Acute illness score: discuss supplements with the dietitian or GP before starting them.');
    }
    if (s3 === 2) r.warnings.push('Little or no intake expected for more than 5 days: tell the nurse in charge and the GP today.');

    r.reviewDays = level === 'high' ? 7 : 28;
    r.reviewNote = 'And sooner if they become unwell, eat less, or their clothes become loose.';
    const p = r.plan;
    p.riskLevel = level;
    p.need = `MUST ${total} — ${level} risk of malnutrition.${bmi !== null ? ` BMI ${bmi}.` : ''}`;
    p.outcome = level === 'low' ? 'Keeps a healthy weight and enjoys their meals.' : 'Weight stays steady or improves; eats and drinks enough each day.';
    p.interventions = r.actions.slice();
    if (level !== 'low') {
      p.schedule = [
        { time: '10:30', what: 'Offer a nourishing snack or drink' },
        { time: '15:00', what: 'Offer a nourishing snack or drink' },
        { time: '20:00', what: 'Offer a nourishing supper snack or drink' },
      ];
      p.details = { foodChart: true, fortified: level === 'high' };
      r.facts.push(level === 'high' ? 'Nutrition: high risk — fortified food and snacks between meals' : 'Nutrition: record all food and drink');
    }
    if (level === 'high') p.schedule!.push({ time: '10:00', what: 'Weigh (same scales, same time of day)', dayOfWeek: 1 });
    return r;
  },
};


// ── 3. Falls — multifactorial (NICE NG249) ───────────────────────────────────
// No score, by design. Each factor is either a concern or not; each concern
// needs at least one action. The count of concerns is stored, never shown as risk.

interface Factor { key: string; label: string; hint: string; actions: Option[] }
const FALL_FACTORS: Factor[] = [
  { key: 'history', label: 'Falls in the last 12 months', hint: 'How many, where, when, what they were doing, any injury, and whether they could get up.', actions: [
    { value: 'pattern', label: 'Look for a pattern in when and where they fall (time, place, activity) and plan around it' },
    { value: 'postfall', label: 'After any fall: check for injury before moving them, and follow the post-fall procedure' },
    { value: 'refer', label: 'Ask the GP to refer them to the falls service for a specialist assessment' },
  ] },
  { key: 'fear', label: 'Fear of falling', hint: 'Do they avoid moving, or say they are frightened of falling?', actions: [
    { value: 'confidence', label: 'Build confidence: short supervised walks, praise, and no rushing' },
    { value: 'physio', label: 'Ask for a physiotherapy referral' },
  ] },
  { key: 'mobility', label: 'Problems with walking, balance or strength', hint: 'Unsteady, shuffling, holding on to furniture, needs help to stand.', actions: [
    { value: 'aid', label: 'Walking aid always within reach, and checked (ferrules, brakes, height)', fact: 'Walking aid always within reach' },
    { value: 'supervise', label: 'Supervise when walking', fact: 'Supervise when walking' },
    { value: 'exercise', label: 'Strength and balance exercise (physiotherapy or a falls-prevention programme)' },
    { value: 'active', label: 'Encourage movement through the day to keep strength' },
  ] },
  { key: 'medicines', label: 'Medicines that can cause falls', hint: 'Sedatives, sleeping tablets, antipsychotics, antidepressants, opioids, blood pressure tablets, diuretics, or many regular medicines.', actions: [
    { value: 'review', label: 'Ask the GP or pharmacist for a medication review, focused on falls' },
    { value: 'watch', label: 'Watch for drowsiness or dizziness after doses, and report it' },
  ] },
  { key: 'postural', label: 'Dizziness on standing, blackouts or fainting', hint: 'Light-headed when getting up, unexplained falls, any blackout.', actions: [
    { value: 'lsbp', label: 'Ask the nurse or GP to check lying and standing blood pressure' },
    { value: 'slow', label: 'Stand up slowly: sit on the edge of the bed or chair first', fact: 'Stand up slowly — sit on the edge first' },
    { value: 'blackout', label: 'Report any blackout to the GP the same day' },
  ] },
  { key: 'cognition', label: 'Memory problems, confusion or delirium', hint: 'Including confusion that is new or worse than usual.', actions: [
    { value: 'delirium', label: 'If confusion is new or worse, look for causes (infection, pain, constipation, dehydration, new medicines) and tell the nurse' },
    { value: 'rounding', label: 'Regular planned checks: offer the toilet, a drink and a walk' },
    { value: 'sensor', label: 'Consider a sensor mat — only as the least restrictive option, with an MCA assessment and best-interests decision if they cannot consent' },
  ] },
  { key: 'continence', label: 'Urgency, frequency, or getting up at night for the toilet', hint: 'Rushing to the toilet is a common cause of falls.', actions: [
    { value: 'toileting', label: 'Offer the toilet at regular times, including before bed', fact: 'Offer the toilet regularly, and before bed' },
    { value: 'route', label: 'Clear, lit route to the toilet at night' },
    { value: 'gp', label: 'Ask the GP or continence service to review (e.g. infection, night-time passing urine)' },
  ] },
  { key: 'vision', label: 'Sight problems', hint: 'Glasses not worn, not clean, or no eye test in the last year.', actions: [
    { value: 'glasses', label: 'Glasses clean, worn and within reach', fact: 'Glasses on, clean, within reach' },
    { value: 'eyetest', label: 'Arrange an eye test' },
    { value: 'lighting', label: 'Good lighting, and a night light' },
  ] },
  { key: 'feet', label: 'Foot problems or unsafe footwear', hint: 'Painful feet, long nails, swollen feet, loose slippers, walking in socks.', actions: [
    { value: 'footwear', label: 'Well-fitting shoes or slippers with a back and a non-slip sole', fact: 'Well-fitting footwear with a back — never socks only' },
    { value: 'podiatry', label: 'Refer to podiatry' },
  ] },
  { key: 'conditions', label: 'Health conditions that affect falls', hint: 'Parkinson\'s, stroke, arthritis, diabetes, heart problems, an infection now.', actions: [
    { value: 'gp', label: 'Make sure the GP knows about the falls and these conditions' },
    { value: 'pain', label: 'Review pain relief if pain stops them moving safely' },
  ] },
  { key: 'environment', label: 'Hazards in their room or the home', hint: 'Bed height, clutter, trailing wires, rugs, call bell out of reach.', actions: [
    { value: 'bed', label: 'Bed at the right height (feet flat on the floor when sitting)' },
    { value: 'bell', label: 'Call bell within reach, and they can use it', fact: 'Call bell within reach' },
    { value: 'clutter', label: 'Clear clutter, rugs and trailing wires' },
  ] },
  { key: 'injury', label: 'More likely to be hurt if they fall', hint: 'Osteoporosis, a previous fracture, or on blood thinners (anticoagulants).', actions: [
    { value: 'bone', label: 'Ask the GP to consider a bone-health review' },
    { value: 'hip', label: 'Offer hip protectors, if they find them acceptable' },
    { value: 'anticoag', label: 'On blood thinners: after any fall involving the head, get medical advice straight away', fact: 'On blood thinners — any head knock: get medical advice now' },
  ] },
];

const falls: Tool = {
  key: 'falls', name: 'Falls — multifactorial assessment', shortName: 'Falls', version: 'nice-ng249/cv88',
  purpose: 'What makes falls more likely for this person, and what is being done about each thing.',
  who: 'A nurse or senior carer who knows the person, with input from the person and family. On admission, after any fall, and when their health, medicines or mobility change.',
  domain: 'safety_risk', scored: false,
  sources: [
    { label: 'NICE NG249 Falls: assessment and prevention in older people (2025)', url: 'https://www.nice.org.uk/guidance/ng249' },
  ],
  sections: FALL_FACTORS.map(f => ({
    key: f.key, title: f.label, intro: f.hint,
    questions: [
      { key: `${f.key}`, label: `${f.label}?`, type: 'choice', options: [
        { value: 'yes', label: 'Yes — this is a concern' }, { value: 'no', label: 'No' },
        { value: 'unknown', label: 'Could not assess yet' },
      ] },
      ...(f.key === 'history' ? [{ key: 'falls_count', label: 'How many falls in the last 12 months?', type: 'number' as const, min: 0, max: 100, optional: true }] : []),
      { key: `${f.key}_actions`, label: 'What will be done', type: 'multi' as const, options: f.actions, optional: true, showIf: (a: Answers) => a[f.key] === 'yes' },
      { key: `${f.key}_note`, label: 'Details', type: 'text' as const, optional: true, showIf: (a: Answers) => a[f.key] === 'yes' || a[f.key] === 'unknown' },
    ],
  })),
  evaluate(a) {
    const t = falls;
    const r = base(t, a, t.domain);
    const found = FALL_FACTORS.filter(f => a[f.key] === 'yes');
    const unknown = FALL_FACTORS.filter(f => a[f.key] === 'unknown');
    r.level = 'not_scored';
    r.storedScore = found.length;
    r.headline = found.length === 0 ? 'No factors found that need action' : found.length === 1 ? '1 thing to act on' : `${found.length} things to act on`;
    for (const f of found) {
      const chosen = list(a[`${f.key}_actions`]).map(v => f.actions.find(o => o.value === v)).filter((o): o is Option => !!o);
      const note = str(a[`${f.key}_note`]);
      r.reasons.push(`${f.label}${note ? ` — ${note}` : ''}`);
      if (chosen.length === 0 && !note) r.errors.push(`${f.label}: choose at least one action, or write what will be done.`);
      for (const c of chosen) { r.actions.push(c.label); if (c.fact) r.facts.push(c.fact); }
      if (chosen.length === 0 && note) r.actions.push(`${f.label}: ${note}`);
    }
    for (const f of unknown) r.warnings.push(`${f.label} could not be assessed yet — complete it as soon as you can.`);
    const n = num(a.falls_count);
    if (a.history === 'yes' && n !== null && n >= 2) r.warnings.push(`${n} falls in a year: ask the GP to refer them to a specialist falls service (NICE NG249).`);
    r.reviewDays = 28;
    r.reviewNote = 'And after any fall, or when their health, medicines or mobility change (NICE NG249).';
    r.plan.need = found.length ? `Falls assessment found: ${found.map(f => f.label.toLowerCase()).join('; ')}.` : 'Falls assessment found nothing that needs action now.';
    r.plan.outcome = 'Stays as independent and active as they want to be, with fewer falls and less harm from any fall.';
    r.plan.interventions = uniq(r.actions);
    r.facts = uniq(r.facts);
    // Carers see these on the resident; the full reasoning stays in the plan.
    r.plan.details = { fallsPrecautions: r.facts.length ? r.facts : null };
    return r;
  },
};

// ── 4. Moving and handling ───────────────────────────────────────────────────
// Person-specific handling plan. HSE: the plan must say which hoist for which
// task, the sling type and size and loop configuration, and how many carers.

const STAFF: Option[] = [
  { value: 'na', label: 'Not applicable', points: -1 },
  { value: 'independent', label: 'Independent', points: 0 },
  { value: 'supervision', label: 'Supervision or prompting only', points: 0 },
  { value: '1', label: '1 carer', points: 1 },
  { value: '2', label: '2 carers', points: 2 },
  { value: '3', label: '3 or more carers', points: 3 },
];
const EQUIP: Option[] = [
  { value: 'none', label: 'No equipment', exclusive: true },
  { value: 'stick', label: 'Walking stick' },
  { value: 'frame', label: 'Walking frame' },
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'belt', label: 'Handling belt' },
  { value: 'slide_sheet', label: 'Slide sheets' },
  { value: 'disc', label: 'Turntable / turning disc' },
  { value: 'stand_aid', label: 'Standing aid (e.g. rotating stand aid)' },
  { value: 'stand_hoist', label: 'Standing hoist' },
  { value: 'full_hoist', label: 'Full (mobile or ceiling) hoist' },
  { value: 'bath_hoist', label: 'Bath or shower hoist / chair' },
  { value: 'lift_cushion', label: 'Emergency lifting cushion' },
  { value: 'grab_rails', label: 'Grab rails / toilet frame' },
];
const MH_TASKS = [
  { key: 'reposition', label: 'Moving in bed (turning, sitting up)' },
  { key: 'bed_chair', label: 'Bed to chair or wheelchair' },
  { key: 'sit_stand', label: 'Sit to stand' },
  { key: 'walking', label: 'Walking' },
  { key: 'toilet', label: 'Toileting' },
  { key: 'bathing', label: 'Bathing or showering' },
  { key: 'floor', label: 'Getting up from the floor after a fall' },
];
const HOIST = ['stand_hoist', 'full_hoist', 'bath_hoist'];

const movingHandling: Tool = {
  key: 'moving_handling', name: 'Moving and handling plan', shortName: 'Moving & handling', version: 'hse-tile/cv88',
  purpose: 'How to help this person move safely, task by task: method, equipment, sling and number of carers.',
  who: 'A moving and handling trained assessor. On admission, monthly, and whenever their mobility, weight or health changes.',
  domain: 'mobility_transfers', scored: false,
  sources: [
    { label: 'HSE — Moving and handling equipment (hoists and slings)', url: 'https://www.hse.gov.uk/healthservices/moving-handling-equipment.htm' },
    { label: 'HSE — LOLER thorough examination of lifting equipment', url: 'https://www.hse.gov.uk/work-equipment-machinery/loler.htm' },
  ],
  sections: [
    { key: 'person', title: 'The person', intro: 'Think about the person (TILE: Task, Individual, Load, Environment).', questions: [
      { key: 'weight_kg', label: 'Weight', type: 'number', unit: 'kg', min: 20, max: 350 },
      { key: 'weight_bearing', label: 'Can they bear weight through their legs?', type: 'choice', options: [
        { value: 'full', label: 'Yes, fully' }, { value: 'partial', label: 'Partly, or not reliably' }, { value: 'none', label: 'No' },
      ] },
      { key: 'sitting_balance', label: 'Can they sit unsupported on the edge of the bed?', type: 'choice', options: YES_NO },
      { key: 'grip', label: 'Can they hold on with both hands (e.g. to a standing aid)?', type: 'choice', options: YES_NO },
      { key: 'cooperation', label: 'Can they understand and help with a move?', type: 'choice', options: [
        { value: 'yes', label: 'Yes' }, { value: 'variable', label: 'It varies' }, { value: 'no', label: 'No' },
      ] },
      { key: 'factors', label: 'Anything else that affects moving them', type: 'multi', options: [
        { value: 'none', label: 'None of these', exclusive: true },
        { value: 'pain', label: 'Pain on movement' },
        { value: 'spasm', label: 'Spasms or involuntary movements' },
        { value: 'fragile_skin', label: 'Fragile skin or wounds' },
        { value: 'attachments', label: 'Catheter, drain, oxygen or other attachments' },
        { value: 'distress', label: 'Distress or resistance during care' },
        { value: 'fatigue', label: 'Tires quickly, or varies through the day' },
        { value: 'fracture', label: 'Recent fracture or joint replacement precautions' },
      ] },
    ] },
    ...MH_TASKS.map(task => ({
      key: task.key, title: task.label, questions: [
        { key: `${task.key}_staff`, label: 'Help needed', type: 'choice' as const, options: STAFF },
        { key: `${task.key}_equip`, label: 'Equipment', type: 'multi' as const, options: EQUIP, showIf: (a: Answers) => !!a[`${task.key}_staff`] && a[`${task.key}_staff`] !== 'na' },
        { key: `${task.key}_how`, label: 'How, in their words where possible', type: 'text' as const, optional: true, showIf: (a: Answers) => !!a[`${task.key}_staff`] && a[`${task.key}_staff`] !== 'na' },
      ],
    })),
    { key: 'sling', title: 'Hoist and sling', intro: 'Every hoist transfer needs the exact sling.', questions: [
      { key: 'hoist_model', label: 'Which hoist', type: 'text', optional: true, showIf: usesHoist },
      { key: 'sling_type', label: 'Sling type', type: 'choice', showIf: usesHoist, options: [
        { value: 'general', label: 'General purpose / full body' }, { value: 'access', label: 'Access / toileting' },
        { value: 'hammock', label: 'Hammock' }, { value: 'in_situ', label: 'In-situ (stays in the chair)' },
        { value: 'stand_belt', label: 'Standing hoist belt / vest' }, { value: 'bariatric', label: 'Bariatric' },
        { value: 'other', label: 'Other (say in notes)' },
      ] },
      { key: 'sling_size', label: 'Sling size', type: 'choice', showIf: usesHoist, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => ({ value: s, label: s })) },
      { key: 'sling_loops', label: 'Loop configuration (colours or positions, shoulder and leg)', hint: 'Use the same configuration on both sides (HSE).', type: 'text', showIf: usesHoist },
    ] },
  ],
  prefill(ctx) { return ctx.weightKg ? { weight_kg: ctx.weightKg } : {}; },
  evaluate(a) {
    const t = movingHandling;
    const r = base(t, a, t.domain);
    if (usesHoist(a) && !str(a.sling_loops)) r.missing.push('sling_loops');
    r.complete = r.missing.length === 0;
    const wb = str(a.weight_bearing);
    let maxStaff = 0, anyHoist = false, anyHelp = false;
    const equipment: string[] = [];
    const lines: string[] = [];
    for (const task of MH_TASKS) {
      const s = str(a[`${task.key}_staff`]);
      if (!s || s === 'na') continue;
      const eq = list(a[`${task.key}_equip`]);
      if (eq.includes('none') && eq.length > 1) r.errors.push(`${task.label}: "No equipment" cannot be chosen with equipment.`);
      const staffN = s === '3' ? 3 : s === '2' ? 2 : s === '1' ? 1 : 0;
      const eqLabels = labelsOf(t, `${task.key}_equip`, a);
      equipment.push(...eqLabels);
      const hoist = eq.some(e => HOIST.includes(e));
      // Getting up from the floor is an emergency plan, not everyday care:
      // it is planned and listed, but does not make someone "high dependency".
      if (task.key !== 'floor') {
        maxStaff = Math.max(maxStaff, staffN);
        if (staffN > 0 || eq.some(e => e !== 'none')) anyHelp = true;
        anyHoist = anyHoist || hoist;
      }
      const staffLabel = STAFF.find(o => o.value === s)?.label || s;
      const how = str(a[`${task.key}_how`]);
      lines.push(`${task.label}: ${[eqLabels.join(' + ') || 'no equipment', staffLabel.toLowerCase()].join(', ')}${how ? ` — ${how}` : ''}`);

      if (eq.includes('full_hoist') && staffN < 2) r.warnings.push(`${task.label}: hoisting is normally done by two trained carers. One carer only if a specific assessment shows it is safe — write down why.`);
      if ((eq.includes('stand_hoist') || eq.includes('stand_aid')) && wb === 'none') r.warnings.push(`${task.label}: a standing hoist or standing aid needs the person to bear some weight. They cannot — use a different method.`);
      if ((eq.includes('stand_hoist') || eq.includes('stand_aid')) && a.grip === 'no') r.warnings.push(`${task.label}: a standing aid or hoist usually needs them to hold on with both hands.`);
      if (task.key === 'walking' && wb === 'none') r.errors.push('Walking: they cannot bear weight, so walking cannot be a planned task. Mark it "Not applicable".');
      if (task.key === 'reposition' && eq.includes('slide_sheet') && staffN < 2) r.warnings.push('Moving in bed with slide sheets is normally a two-carer task.');
      if (task.key === 'floor' && staffN > 0 && !eq.some(e => e === 'full_hoist' || e === 'lift_cushion')) r.warnings.push('Getting up from the floor: never lift a person from the floor by hand. Plan a hoist or an emergency lifting cushion.');
    }
    if (!lines.length) r.errors.push('Say how they are helped with at least one task.');
    if (usesHoist(a)) {
      const sling = `${labelsOf(t, 'sling_type', a)[0] || ''}${str(a.sling_size) ? ` sling, size ${str(a.sling_size)}` : ''}`;
      if (sling.trim()) equipment.push(sling.trim());
    }
    const w = num(a.weight_kg);
    if (w !== null && w >= 150) r.warnings.push(`Weight ${w} kg: check the safe working load of every item they use (bed, hoist, sling, chair, commode, bath equipment).`);
    const f = list(a.factors);
    if (f.includes('none') && f.length > 1) r.errors.push('"None of these" cannot be chosen with other factors.');
    if (a.cooperation !== 'yes' && a.cooperation) r.actions.push('Explain each step before you do it. If they resist, stop, reassure, and try again later — do not force a move.');
    if (f.includes('pain')) r.actions.push('Offer prescribed pain relief in good time before planned moves.');
    if (f.includes('fragile_skin')) r.actions.push('Protect fragile skin: no dragging; use slide sheets; check skin after moves.');
    if (f.includes('attachments')) r.actions.push('Secure catheters, drains and tubing before every move.');
    if (anyHoist) {
      r.actions.push('Before each hoist use: check the hoist, the sling label and size, and look for wear, tears or fraying.');
      r.actions.push('Hoists and slings need a thorough examination by a competent person every 6 months (LOLER). Check the date on the label.');
    }
    r.actions.push('Keep a copy of this plan where staff can see it in their room.');
    const level = anyHoist || maxStaff >= 2 ? 'high' : anyHelp ? 'medium' : 'low';
    r.level = level;
    r.storedScore = maxStaff;
    r.headline = level === 'high' ? `High dependency — up to ${maxStaff} carer${maxStaff === 1 ? '' : 's'}${anyHoist ? ', hoist' : ''}` : level === 'medium' ? 'Needs some help or equipment' : 'Independent with moving';
    r.reasons = lines.slice();
    r.reviewDays = 28;
    r.reviewNote = 'And whenever their mobility, weight, health or equipment changes.';
    const p = r.plan;
    p.riskLevel = level;
    p.need = `Moving and handling: ${r.headline.toLowerCase()}. Weight-bearing: ${wb || 'not recorded'}.`;
    p.outcome = 'Moves safely and as independently as possible, without injury to them or staff.';
    p.interventions = [...lines, ...r.actions];
    p.equipment = uniq(equipment);
    p.staff = maxStaff ? `${maxStaff} carer${maxStaff === 1 ? '' : 's'}` : 'Independent';
    const transfer = lines.find(l => l.startsWith('Bed to chair'));
    const walkStaff = str(a.walking_staff);
    const walkEq = list(a.walking_equip);
    const walkingAid = walkStaff === 'na' ? 'none_walks' : walkEq.includes('frame') ? 'frame' : walkEq.includes('stick') ? 'stick' : walkEq.includes('wheelchair') ? 'wheelchair' : walkStaff ? 'none' : undefined;
    p.details = {
      weightBearing: wb || undefined, walkingAid, transfers: transfer ? transfer.replace(/^Bed to chair or wheelchair: /, '') : undefined,
      slingType: labelsOf(t, 'sling_type', a)[0], slingSize: str(a.sling_size) || undefined, slingLoops: str(a.sling_loops) || undefined,
      staffForTransfers: maxStaff || undefined,
    };
    if (transfer) r.facts.push(transfer.replace(/^Bed to chair or wheelchair/, 'Transfers'));
    const walk = lines.find(l => l.startsWith('Walking:'));
    if (walk) r.facts.push(walk);
    if (usesHoist(a) && str(a.sling_size)) r.facts.push(`Sling: ${labelsOf(t, 'sling_type', a)[0] || ''} size ${str(a.sling_size)}${str(a.sling_loops) ? ` (${str(a.sling_loops)})` : ''}`.replace(/\s+/g, ' '));
    return r;
  },
};
function usesHoist(a: Answers): boolean {
  return MH_TASKS.some(t => a[`${t.key}_staff`] && a[`${t.key}_staff`] !== 'na' && list(a[`${t.key}_equip`]).some(e => HOIST.includes(e)));
}

// ── 5. Bed rails (MHRA) ──────────────────────────────────────────────────────

const RAIL_CHECKS: Option[] = [
  { value: 'compatible', label: 'The rails are the right type for this bed and mattress' },
  { value: 'gaps', label: 'Gaps are within the standard (BS EN 60601-2-52): between rail and mattress, and at the head and foot ends' },
  { value: 'height', label: 'The rail is at least 220 mm above the uncompressed mattress (more with an overlay)' },
  { value: 'secure', label: 'The rails are fixed securely and do not move when pushed' },
  { value: 'maintained', label: 'They will be re-checked whenever the bed, mattress or rails change, and maintained as the maker says' },
];

const bedRails: Tool = {
  key: 'bed_rails', name: 'Bed rails assessment', shortName: 'Bed rails', version: 'mhra-2023/cv88',
  purpose: 'Whether bed rails are right for this person, and if so that they are safe. Entrapment in bed rails can kill.',
  who: 'A nurse or senior carer, with the person or their representative. Before rails are first used, monthly, and whenever the bed, mattress, rails or the person change.',
  domain: 'night_care', scored: false,
  sources: [
    { label: 'MHRA — Bed rails: management and safe use', url: 'https://www.gov.uk/government/publications/bed-rails-management-and-safe-use' },
    { label: 'NHS England — Never Events list (chest or neck entrapment in bed rails)', url: 'https://www.england.nhs.uk/patient-safety/never-events/' },
  ],
  sections: [
    { key: 'need', title: 'Is there a need?', questions: [
      { key: 'fall_from_bed', label: 'Are they at risk of falling or rolling out of bed?', type: 'choice', options: YES_NO },
      { key: 'gets_out', label: 'Do they get out of bed by themselves, or try to?', type: 'choice', options: [
        { value: 'yes', label: 'Yes' }, { value: 'sometimes', label: 'Sometimes' }, { value: 'no', label: 'No' },
      ] },
      { key: 'confused', label: 'Are they confused, agitated or restless in bed?', type: 'choice', options: YES_NO },
    ] },
    { key: 'person', title: 'Entrapment risk', questions: [
      { key: 'atypical', label: 'Are they very small or slim, or very large, compared with an average adult?', type: 'choice', options: YES_NO },
      { key: 'involuntary', label: 'Do they have spasms or involuntary movements?', type: 'choice', options: YES_NO },
    ] },
    { key: 'wishes', title: 'Their view and consent', questions: [
      { key: 'wishes', label: 'What do they want?', type: 'choice', options: [
        { value: 'want', label: 'They want rails' }, { value: 'dont_want', label: 'They do not want rails' },
        { value: 'cannot_say', label: 'They cannot say' },
      ] },
      { key: 'capacity', label: 'Can they consent to bed rails?', type: 'choice', options: [
        { value: 'yes', label: 'Yes, and they have' },
        { value: 'no_bi', label: 'No — a best-interests decision is recorded (MCA 2005)' },
        { value: 'not_assessed', label: 'Not assessed yet' },
      ] },
    ] },
    { key: 'alternatives', title: 'Alternatives', intro: 'MHRA: consider other ways to keep them safe before choosing rails.', questions: [
      { key: 'alternatives', label: 'Alternatives considered', type: 'multi', options: [
        { value: 'low_bed', label: 'Low or ultra-low bed' }, { value: 'mat', label: 'Crash mat beside the bed' },
        { value: 'sensor', label: 'Sensor mat or alarm' }, { value: 'checks', label: 'More frequent checks' },
        { value: 'positioning', label: 'Positioning aids (wedges, pillows)' },
      ] },
      { key: 'decision', label: 'Decision', type: 'choice', options: [
        { value: 'no_rails', label: 'No bed rails' }, { value: 'rails', label: 'Use bed rails' },
      ] },
    ] },
    { key: 'checks', title: 'Safety checks', intro: 'All of these must be true before rails are used.', questions: [
      { key: 'rail_sides', label: 'Which sides', type: 'choice', showIf: a => a.decision === 'rails', options: [
        { value: 'both', label: 'Both sides' }, { value: 'one', label: 'One side (other side against the wall is NOT a safe alternative)' },
      ] },
      { key: 'bumpers', label: 'Bumpers or covers', type: 'choice', showIf: a => a.decision === 'rails', options: [
        { value: 'yes', label: 'Fitted' }, { value: 'no', label: 'Not needed' },
      ] },
      { key: 'checks', label: 'Checks done', type: 'multi', showIf: a => a.decision === 'rails', options: RAIL_CHECKS },
    ] },
  ],
  evaluate(a) {
    const t = bedRails;
    const r = base(t, a, t.domain);
    const rails = a.decision === 'rails';
    const alts = labelsOf(t, 'alternatives', a);
    r.level = 'not_scored';
    if (a.fall_from_bed === 'no') r.reasons.push('Not at risk of falling from bed.');
    if (a.gets_out === 'yes' || a.gets_out === 'sometimes') r.reasons.push('Gets out of bed, or tries to.');
    if (a.confused === 'yes') r.reasons.push('Confused, agitated or restless in bed.');
    if (a.atypical === 'yes') r.reasons.push('Size makes entrapment more likely.');
    if (a.involuntary === 'yes') r.reasons.push('Spasms or involuntary movements.');
    if (rails) {
      const done = list(a.checks);
      const notDone = RAIL_CHECKS.filter(c => !done.includes(c.value));
      for (const c of notDone) r.errors.push(`Safety check not confirmed: ${c.label}.`);
      if (a.fall_from_bed === 'no') r.warnings.push('Rails are chosen although they are not at risk of falling from bed. Rails can cause harm — write down why they are needed.');
      if (a.gets_out === 'yes' || a.gets_out === 'sometimes' || a.confused === 'yes') r.warnings.push('They may climb over the rails and fall from a greater height. MHRA advises considering a low bed, crash mat or sensor instead.');
      if (a.atypical === 'yes') r.warnings.push('Higher entrapment risk: use rails made for their size (BS EN 50637 covers people of atypical size) and check every gap.');
      if (a.involuntary === 'yes' && a.bumpers !== 'yes') r.warnings.push('Spasms or involuntary movements: fit bumpers so limbs cannot go through or be hurt on the rails.');
      if (a.wishes === 'dont_want' && a.capacity === 'yes') r.errors.push('They have capacity and do not want rails. Rails cannot be used against their wishes.');
      if (a.capacity === 'not_assessed') r.warnings.push('Consent: assess capacity for this decision. If they lack it, record a best-interests decision before using rails.');
      if (a.capacity === 'no_bi') r.warnings.push('Rails restrict movement. Consider whether, with other restrictions, this adds up to a deprivation of liberty that needs a DoLS authorisation.');
      if (alts.length === 0) r.warnings.push('No alternatives recorded. MHRA expects alternatives to be considered before rails.');
      r.headline = 'Bed rails in use, with safety checks';
      r.actions.push('Check the rails, bumpers and gaps every night before settling them, and after any change to the bed or mattress.');
      r.actions.push('Never use rails on a bed or mattress they were not checked with.');
      r.actions.push('Report any near miss (a limb or head through or between rails) at once and stop using the rails until reassessed.');
      r.facts.push(`Bed rails: ${a.rail_sides === 'one' ? 'one side' : 'both sides'}${a.bumpers === 'yes' ? ' with bumpers' : ''} — check fit every night`);
    } else if (a.decision === 'no_rails') {
      r.headline = 'No bed rails';
      if (alts.length) {
        r.actions.push(`Instead: ${alts.join(', ').toLowerCase()}.`);
        r.facts.push(`No bed rails — ${alts.join(', ').toLowerCase()}`);
      } else r.facts.push('No bed rails');
      if (a.fall_from_bed === 'yes' && alts.length === 0) r.warnings.push('At risk of falling from bed with no rails and no alternative recorded. Choose what will keep them safe.');
    }
    r.reviewDays = 28;
    r.reviewNote = 'And whenever the bed, mattress, rails or their condition change (MHRA).';
    const p = r.plan;
    p.need = `Bed rails: ${r.headline.toLowerCase()}.${r.reasons.length ? ' ' + r.reasons.join(' ') : ''}`;
    p.outcome = 'Safe in bed, without entrapment or falls from bed, and as free to move as possible.';
    p.interventions = r.actions.slice();
    p.equipment = rails ? [`Bed rails (${a.rail_sides === 'one' ? 'one side' : 'both sides'})`, ...(a.bumpers === 'yes' ? ['Bed rail bumpers'] : [])] : alts;
    p.details = { bedRails: rails ? `Yes — ${a.rail_sides === 'one' ? 'one side' : 'both sides'}${a.bumpers === 'yes' ? ', bumpers' : ''}` : 'No', bedRailAlternatives: alts };
    if (rails) p.schedule = [{ time: '21:00', what: 'Check bed rails, bumpers and gaps before settling' }];
    return r;
  },
};

// ── 6. Eating, drinking and choking ──────────────────────────────────────────
// IDDSI levels; swallowing red flags; SALT referral. Rules, not a validated score.

export const IDDSI_FOOD: Option[] = [
  { value: '7', label: 'Level 7 — Regular' },
  { value: '7EC', label: 'Level 7 — Easy to chew' },
  { value: '6', label: 'Level 6 — Soft & bite-sized' },
  { value: '5', label: 'Level 5 — Minced & moist' },
  { value: '4', label: 'Level 4 — Pureed' },
  { value: '3', label: 'Level 3 — Liquidised' },
];
export const IDDSI_DRINK: Option[] = [
  { value: '0', label: 'Level 0 — Thin' },
  { value: '1', label: 'Level 1 — Slightly thick' },
  { value: '2', label: 'Level 2 — Mildly thick' },
  { value: '3', label: 'Level 3 — Moderately thick' },
  { value: '4', label: 'Level 4 — Extremely thick' },
];

const eating: Tool = {
  key: 'eating_drinking', name: 'Eating, drinking and choking', shortName: 'Eating & choking', version: 'iddsi-v2/cv88',
  purpose: 'How this person eats and drinks safely: swallowing, choking risk, texture levels, and the help they need.',
  who: 'A nurse or senior carer. Texture levels are set by a speech and language therapist (SALT). On admission, monthly, and after any choking episode or chest infection.',
  domain: 'nutrition_hydration', scored: false,
  sources: [
    { label: 'IDDSI framework', url: 'https://iddsi.org/framework' },
    { label: 'NHS — Dysphagia (swallowing problems)', url: 'https://www.nhs.uk/conditions/swallowing-problems-dysphagia/' },
  ],
  sections: [
    { key: 'signs', title: 'Signs of swallowing difficulty', questions: [
      { key: 'signs', label: 'Have you seen any of these?', type: 'multi', options: [
        { value: 'none', label: 'None of these', exclusive: true },
        { value: 'cough', label: 'Coughing or choking when eating or drinking' },
        { value: 'wet_voice', label: 'Wet or gurgly voice after drinking' },
        { value: 'pocketing', label: 'Food left in the mouth after swallowing' },
        { value: 'slow', label: 'Takes a long time, or tires while eating' },
        { value: 'drooling', label: 'Drooling, or food or drink leaking from the mouth' },
        { value: 'chest', label: 'Repeated chest infections' },
        { value: 'pain', label: 'Pain when swallowing' },
      ] },
      { key: 'salt', label: 'Has a speech and language therapist (SALT) assessed their swallowing?', type: 'choice', options: [
        { value: 'current', label: 'Yes, and the advice is current' }, { value: 'old', label: 'Yes, more than a year ago or before a change' },
        { value: 'no', label: 'No' },
      ] },
      { key: 'salt_date', label: 'Date of SALT advice', type: 'date', optional: true, showIf: a => a.salt === 'current' || a.salt === 'old' },
    ] },
    { key: 'levels', title: 'Food and drink textures (IDDSI)', questions: [
      { key: 'food_level', label: 'Food', type: 'choice', options: IDDSI_FOOD },
      { key: 'drink_level', label: 'Drinks', type: 'choice', options: IDDSI_DRINK },
      { key: 'level_source', label: 'Who set these levels?', type: 'choice', showIf: a => modified(a), options: [
        { value: 'salt', label: 'SALT' }, { value: 'interim', label: 'Interim, by a nurse or GP while waiting for SALT' }, { value: 'other', label: 'Other' },
      ] },
    ] },
    { key: 'choking', title: 'Choking risk', questions: [
      { key: 'choking', label: 'Any of these?', type: 'multi', options: [
        { value: 'none', label: 'None of these', exclusive: true },
        { value: 'episode', label: 'A choking episode in the past' },
        { value: 'rushes', label: 'Rushes food or overfills their mouth' },
        { value: 'takes_food', label: 'Takes food from others, or eats non-food items' },
        { value: 'teeth', label: 'Poor teeth or loose dentures' },
        { value: 'drowsy', label: 'Drowsy at mealtimes, or sedating medicines' },
      ] },
    ] },
    { key: 'support', title: 'Help at mealtimes', questions: [
      { key: 'support', label: 'Help needed', type: 'choice', options: [
        { value: 'independent', label: 'Independent' }, { value: 'setup', label: 'Set-up only (cut up, open packets)' },
        { value: 'prompt', label: 'Prompting and supervision' }, { value: 'full', label: 'Full help to eat and drink' },
      ] },
      { key: 'aids', label: 'Eating and drinking aids', type: 'multi', optional: true, options: [
        { value: 'cutlery', label: 'Adapted cutlery' }, { value: 'plate_guard', label: 'Plate guard or lipped plate' },
        { value: 'mat', label: 'Non-slip mat' }, { value: 'cup', label: 'Two-handled or adapted cup' },
        { value: 'coloured', label: 'Coloured plate (for people with dementia)' },
      ] },
      { key: 'diet', label: 'Diet (e.g. diabetic, vegetarian, halal, allergies)', type: 'text', optional: true },
      { key: 'likes', label: 'Likes, dislikes and how they like to eat', type: 'text', optional: true },
      { key: 'fluid_target', label: 'Daily drinks target', type: 'number', unit: 'ml', min: 500, max: 4000, optional: true },
    ] },
  ],
  evaluate(a) {
    const t = eating;
    const r = base(t, a, t.domain);
    const signs = list(a.signs).filter(s => s !== 'none');
    const choke = list(a.choking).filter(s => s !== 'none');
    if (list(a.signs).includes('none') && signs.length) r.errors.push('Signs: "None of these" cannot be chosen with other signs.');
    if (list(a.choking).includes('none') && choke.length) r.errors.push('Choking: "None of these" cannot be chosen with other items.');
    const mod = modified(a);
    for (const s of labelsOf(t, 'signs', a)) r.reasons.push(`Sign: ${s}`);
    for (const s of labelsOf(t, 'choking', a)) r.reasons.push(`Choking risk: ${s}`);
    if (signs.length && a.salt !== 'current') {
      r.actions.push('Refer to speech and language therapy (SALT), usually through the GP, for a swallowing assessment.');
      r.warnings.push('Signs of swallowing difficulty without current SALT advice. Tell the nurse in charge today.');
    }
    if (mod && a.level_source && a.level_source !== 'salt') r.warnings.push('Texture levels should be set by a SALT. Make sure a SALT assessment is requested to confirm them.');
    if (a.salt === 'old' && (signs.length || mod)) r.actions.push('Ask SALT to review: the advice is old or their swallowing has changed.');
    if (signs.includes('chest')) r.actions.push('Repeated chest infections can mean food or drink is going into the lungs. Tell the GP.');
    if (choke.includes('episode') || mod) r.actions.push('Make sure everyone on shift knows what to do if they choke (back blows, then abdominal thrusts) and calls for help.');
    if (choke.includes('takes_food')) r.actions.push('Supervise at meals and snack times; keep other people\'s food and non-food items out of reach.');
    if (choke.includes('rushes')) r.actions.push('Offer small mouthfuls and a slower pace; sit with them.');
    if (choke.includes('teeth')) r.actions.push('Arrange a dental review; make sure dentures fit and are in for meals.');
    if (choke.includes('drowsy')) r.actions.push('Only offer food and drink when they are fully awake and alert.');
    r.actions.push('Sit upright (as close to 90° as possible) for meals and drinks, and for 30 minutes afterwards.');
    if (mod) r.actions.push('Every meal, snack and drink must be the right IDDSI level — including at activities, from visitors, and with medicines.');
    if (a.support === 'full') r.actions.push('Sit at eye level beside them, offer small amounts at their pace, and check the mouth is clear before the next mouthful.');

    const level = signs.length || mod || choke.includes('episode') ? 'high' : choke.length || a.support === 'full' || a.support === 'prompt' ? 'medium' : 'low';
    r.level = level;
    r.storedScore = signs.length + choke.length;
    r.headline = level === 'high' ? 'Needs swallowing and choking precautions' : level === 'medium' ? 'Needs some help or watching at mealtimes' : 'Eats and drinks safely';
    r.reviewDays = level === 'low' ? 90 : 28;
    r.reviewNote = 'And straight away after any choking episode, a chest infection, or a change in SALT advice.';

    const food = IDDSI_FOOD.find(o => o.value === str(a.food_level))?.label;
    const drink = IDDSI_DRINK.find(o => o.value === str(a.drink_level))?.label;
    const support = q(t, 'support')?.options?.find(o => o.value === str(a.support))?.label;
    const p = r.plan;
    p.riskLevel = level;
    p.need = `${r.headline}. Food: ${food || 'not set'}; drinks: ${drink || 'not set'}. ${support ? `Help: ${support.toLowerCase()}.` : ''}`.trim();
    p.outcome = 'Eats and drinks enough, enjoys meals, and does not choke or get chest infections from swallowing.';
    p.interventions = r.actions.slice();
    p.equipment = labelsOf(t, 'aids', a);
    p.details = {
      iddsiFood: str(a.food_level) || undefined, iddsiDrink: str(a.drink_level) || undefined,
      mealSupport: str(a.support) || undefined, eatingAids: labelsOf(t, 'aids', a),
      diet: str(a.diet) || undefined, fluidTargetMl: num(a.fluid_target) || undefined,
    };
    if (mod || a.food_level === '7EC') {
      if (food && a.food_level !== '7') r.facts.push(`Food: ${food}`);
      if (drink && a.drink_level !== '0') r.facts.push(`Drinks: ${drink}`);
    }
    if (a.support === 'full') r.facts.push('Needs full help to eat and drink');
    else if (a.support === 'prompt') r.facts.push('Supervise at meals');
    if (level === 'high') r.facts.push('Sit upright for meals and 30 minutes after');
    return r;
  },
};
function modified(a: Answers): boolean {
  return (!!a.food_level && !['7'].includes(str(a.food_level))) || (!!a.drink_level && str(a.drink_level) !== '0');
}

// ── 7. Oral health (OHAT + NICE NG48) ────────────────────────────────────────

const OHAT: { key: string; label: string; opts: [string, string, string]; noneLabel?: string }[] = [
  { key: 'lips', label: 'Lips', opts: ['Smooth, pink, moist', 'Dry, chapped, or red at the corners', 'Swelling or lump, white/red/ulcerated patch, or bleeding/ulcerated at the corners'] },
  { key: 'tongue', label: 'Tongue', opts: ['Normal, moist, roughness, pink', 'Patchy, fissured, red, coated', 'Patch that is red and/or white, ulcerated, swollen'] },
  { key: 'gums', label: 'Gums and tissues', opts: ['Pink, moist, smooth, no bleeding', 'Dry, shiny, rough, red, swollen, or one ulcer/sore spot under dentures', 'Swollen, bleeding, ulcers, white/red patches, or generalised redness under dentures'] },
  { key: 'saliva', label: 'Saliva', opts: ['Moist tissues, watery and free-flowing saliva', 'Dry, sticky tissues, little saliva; they think their mouth is dry', 'Tissues parched and red, very little or no saliva, or thick saliva'] },
  { key: 'teeth', label: 'Natural teeth', noneLabel: 'No natural teeth', opts: ['No decayed or broken teeth or roots', '1–3 decayed or broken teeth or roots, or very worn teeth', '4 or more decayed or broken teeth or roots, very worn teeth, or fewer than 4 teeth'] },
  { key: 'dentures', label: 'Dentures', noneLabel: 'No dentures', opts: ['No broken areas or teeth, worn regularly, and named', '1 broken area or tooth, worn only 1–2 hours a day, not named, or loose', 'More than 1 broken area or tooth, missing or not worn, loose and needing adhesive'] },
  { key: 'cleanliness', label: 'Oral cleanliness', opts: ['Clean, no food particles or tartar in the mouth or on dentures', 'Food, tartar or plaque in 1–2 areas of the mouth or a small area of dentures, or bad breath', 'Food, tartar or plaque in most of the mouth or most of the dentures, or severe bad breath'] },
  { key: 'pain', label: 'Dental pain', opts: ['No behavioural, verbal or physical signs of dental pain', 'Verbal or behavioural signs, e.g. pulling at the face, chewing lips, not eating, aggression', 'Physical signs (swollen cheek or gum, broken teeth, ulcers) as well as verbal or behavioural signs'] },
];

const oral: Tool = {
  key: 'oral_health', name: 'Oral health (OHAT)', shortName: 'Oral health', version: 'ohat-2005+ng48/cv88',
  purpose: 'The state of their mouth, teeth and dentures, the help they need with mouth care, and whether a dentist should see them.',
  who: 'A trained carer, senior or nurse. On admission (NICE: as soon as possible), then as the plan says, and if they stop eating or seem in pain.',
  domain: 'personal_care', scored: true,
  sources: [
    { label: 'NICE NG48 Oral health for adults in care homes', url: 'https://www.nice.org.uk/guidance/ng48' },
    { label: 'Oral Health Assessment Tool (Chalmers et al., 2005) — scoring guide', url: 'https://igec.uiowa.edu/ohat' },
  ],
  sections: [
    { key: 'ohat', title: 'Look in their mouth', intro: 'Score each area 0 (healthy), 1 (changes) or 2 (unhealthy). Use a torch and gloves; remove dentures to look.', questions:
      OHAT.map(o => ({ key: o.key, label: o.label, type: 'choice' as const, options: [
        ...(o.noneLabel ? [{ value: 'na', label: o.noneLabel, points: 0 }] : []),
        { value: '0', label: `0 — ${o.opts[0]}`, points: 0 },
        { value: '1', label: `1 — ${o.opts[1]}`, points: 1 },
        { value: '2', label: `2 — ${o.opts[2]}`, points: 2 },
      ] })) },
    { key: 'care', title: 'Mouth care and dentist', questions: [
      { key: 'brushing', label: 'Help needed to clean teeth or dentures', type: 'choice', options: [
        { value: 'independent', label: 'Independent' }, { value: 'prompt', label: 'Needs reminding' },
        { value: 'some', label: 'Needs some help' }, { value: 'full', label: 'Needs full help' },
      ] },
      { key: 'denture_type', label: 'Dentures', type: 'choice', options: [
        { value: 'none', label: 'None' }, { value: 'upper', label: 'Upper' }, { value: 'lower', label: 'Lower' },
        { value: 'both', label: 'Upper and lower' }, { value: 'partial', label: 'Partial' },
      ] },
      { key: 'denture_marked', label: 'Are the dentures marked with their name?', type: 'choice', showIf: a => !!a.denture_type && a.denture_type !== 'none', options: YES_NO },
      { key: 'dentist', label: 'Do they have a dentist?', type: 'choice', options: YES_NO },
      { key: 'dentist_name', label: 'Dentist or practice', type: 'text', optional: true, showIf: a => a.dentist === 'yes' },
      { key: 'last_visit', label: 'Last dental check', type: 'date', optional: true },
      { key: 'refuses', label: 'Do they often refuse or resist mouth care?', type: 'choice', options: YES_NO },
    ] },
  ],
  evaluate(a) {
    const t = oral;
    const r = base(t, a, t.domain);
    let total = 0, anyTwo = false;
    for (const o of OHAT) {
      const v = str(a[o.key]);
      const n = v === '1' ? 1 : v === '2' ? 2 : 0;
      total += n;
      if (n === 2) anyTwo = true;
      if (n > 0) r.reasons.push(`${o.label}: ${n} — ${o.opts[n]}`);
    }
    if (a.dentures === 'na' && a.denture_type && a.denture_type !== 'none') r.errors.push('Dentures are recorded below, but "No dentures" was chosen in the mouth check.');
    if (a.dentures && a.dentures !== 'na' && a.denture_type === 'none') r.errors.push('The mouth check scored dentures, but "None" is chosen below.');
    const pain = str(a.pain) === '1' || str(a.pain) === '2';
    const refer = anyTwo || total >= 5 || pain;
    r.score = total; r.storedScore = total; r.maxScore = 16;
    r.level = refer ? 'high' : total > 0 ? 'medium' : 'low';
    r.headline = refer ? `See a dentist (OHAT ${total})` : total > 0 ? `Some changes (OHAT ${total})` : 'Healthy mouth (OHAT 0)';
    if (refer) {
      r.actions.push('Arrange a dental review: contact their dentist, or the community dental service.');
      if (pain) r.warnings.push('Signs of dental pain. Tell the nurse in charge; offer prescribed pain relief and arrange a dentist.');
    }
    const teeth = a.teeth && a.teeth !== 'na';
    if (teeth) r.actions.push('Brush natural teeth twice a day with fluoride toothpaste, including last thing at night. Spit, do not rinse.');
    if (a.denture_type && a.denture_type !== 'none') {
      r.actions.push('Clean dentures every day (brush, soak, brush again). Take them out at night unless advised otherwise, and store in a named pot.');
      if (a.denture_marked === 'no') r.actions.push('Ask, with their consent, for the dentures to be marked with their name.');
    }
    if (str(a.saliva) !== '0' && a.saliva) r.actions.push('Dry mouth: offer frequent sips of water; tell the nurse, who may ask the GP about saliva substitutes or a medicine review.');
    if (a.dentist === 'no') r.actions.push('Help them register with a dentist, or with the community dental service if they cannot get to a practice.');
    if (a.refuses === 'yes') r.actions.push('If they refuse: try later, try a carer they know, explain each step, and write in the plan what works.');
    r.reviewDays = refer ? 7 : total > 0 ? 28 : 90;
    r.reviewNote = 'And whenever they stop eating, seem in pain, or their dentures change (NICE NG48).';
    const help = q(t, 'brushing')?.options?.find(o => o.value === str(a.brushing))?.label;
    const dent = q(t, 'denture_type')?.options?.find(o => o.value === str(a.denture_type))?.label;
    const p = r.plan;
    p.riskLevel = r.level === 'high' ? 'high' : r.level === 'medium' ? 'medium' : 'low';
    p.need = `Oral health: ${r.headline}.${help ? ` Mouth care: ${help.toLowerCase()}.` : ''}${dent && dent !== 'None' ? ` Dentures: ${dent.toLowerCase()}.` : ''}`;
    p.outcome = 'Clean, comfortable mouth; can eat, speak and smile without pain.';
    p.interventions = r.actions.slice();
    p.details = {
      mouthCareHelp: str(a.brushing) || undefined, dentures: str(a.denture_type) || undefined,
      denturesMarked: a.denture_marked ? a.denture_marked === 'yes' : undefined,
      dentist: str(a.dentist_name) || (a.dentist === 'no' ? 'None' : undefined), lastDentalCheck: str(a.last_visit) || undefined,
    };
    p.schedule = [];
    if (teeth || (a.denture_type && a.denture_type !== 'none')) {
      p.schedule.push({ time: '08:00', what: teeth ? 'Mouth care: brush teeth with fluoride toothpaste' : 'Mouth care: clean dentures and mouth' });
      p.schedule.push({ time: '21:00', what: a.denture_type && a.denture_type !== 'none' ? 'Mouth care: remove and clean dentures, brush any natural teeth' : 'Mouth care: brush teeth with fluoride toothpaste' });
    }
    if (dent && dent !== 'None') r.facts.push(`Dentures: ${dent.toLowerCase()} — out at night, in a named pot`);
    if (a.brushing === 'full') r.facts.push('Mouth care: needs full help, twice a day');
    return r;
  },
};

// ── 8. PEEP ──────────────────────────────────────────────────────────────────

const EVAC: Option[] = [
  { value: 'unaided', label: 'Walks out unaided', points: 0 },
  { value: 'aid_supervision', label: 'Walks with an aid and someone guiding them', points: 1 },
  { value: 'one', label: 'Needs 1 member of staff', points: 1 },
  { value: 'two', label: 'Needs 2 members of staff', points: 2 },
  { value: 'three_equipment', label: 'Needs 3 or more staff, or evacuation equipment', points: 3 },
  { value: 'bed', label: 'Bed-bound — evacuate on the bed or an evacuation mattress', points: 3 },
];

const peep: Tool = {
  key: 'peep', name: 'Personal emergency evacuation plan (PEEP)', shortName: 'PEEP', version: 'rpeep-fire/cv88',
  purpose: 'How this person gets out, or to a place of safety, if there is a fire — by day and by night.',
  who: 'A senior carer or manager with fire safety training. On admission, and whenever their mobility, room or medicines change.',
  domain: 'safety_risk', scored: false,
  sources: [
    { label: 'Fire and rescue RPEEP template (red / amber categories)', url: 'https://www.twfire.gov.uk/wp-content/uploads/2026/04/RPEEPs-Template.pdf' },
    { label: 'GOV.UK — Fire safety risk assessment: residential care premises', url: 'https://www.gov.uk/government/publications/fire-safety-risk-assessment-residential-care-premises' },
  ],
  sections: [
    { key: 'where', title: 'Where they are', questions: [
      { key: 'floor', label: 'Floor', type: 'choice', options: [
        { value: 'ground', label: 'Ground floor' }, { value: 'first', label: 'First floor' },
        { value: 'second', label: 'Second floor' }, { value: 'higher', label: 'Higher' },
      ] },
      { key: 'room', label: 'Room', type: 'text', optional: true },
    ] },
    { key: 'alarm', title: 'Alarm and understanding', questions: [
      { key: 'hears', label: 'Would they hear the fire alarm and respond?', type: 'choice', options: [
        { value: 'yes', label: 'Yes' }, { value: 'alert', label: 'Needs alerting (e.g. hearing loss, asleep on medicines)' }, { value: 'no', label: 'No' },
      ] },
      { key: 'alert_how', label: 'How to alert them', type: 'text', optional: true, showIf: a => a.hears === 'alert' || a.hears === 'no' },
      { key: 'understands', label: 'Will they follow instructions in an emergency?', type: 'choice', options: [
        { value: 'yes', label: 'Yes' }, { value: 'reassure', label: 'Needs reassurance and guiding' },
        { value: 'may_refuse', label: 'May refuse, resist, or go back to their room' },
      ] },
    ] },
    { key: 'move', title: 'Getting them out', questions: [
      { key: 'day', label: 'By day', type: 'choice', options: EVAC },
      { key: 'night', label: 'By night', hint: 'Often different: asleep, sedated, or in bed.', type: 'choice', options: EVAC },
      { key: 'equipment', label: 'Evacuation equipment', type: 'multi', options: [
        { value: 'none', label: 'None needed', exclusive: true },
        { value: 'wheelchair', label: 'Wheelchair' }, { value: 'evac_chair', label: 'Evacuation chair (stairs)' },
        { value: 'evac_mattress', label: 'Evacuation mattress or ski sheet' }, { value: 'bed', label: 'Their bed (horizontal evacuation)' },
      ] },
      { key: 'medical', label: 'Medical equipment or other needs', type: 'multi', optional: true, options: [
        { value: 'oxygen', label: 'Oxygen' }, { value: 'bariatric', label: 'Bariatric' }, { value: 'other_equipment', label: 'Other medical equipment' },
      ] },
      { key: 'route', label: 'Route and place of safety', hint: 'e.g. through the fire doors to the next compartment, then out via the east exit.', type: 'text' },
      { key: 'notes', label: 'Anything else that helps (e.g. take glasses, calm voice, a familiar carer)', type: 'text', optional: true },
    ] },
  ],
  prefill(ctx) { return ctx.roomNumber ? { room: ctx.roomNumber } : {}; },
  evaluate(a) {
    const t = peep;
    const r = base(t, a, t.domain);
    if (!str(a.route)) r.missing.push('route');
    r.complete = r.missing.length === 0;
    const eq = list(a.equipment);
    if (eq.includes('none') && eq.length > 1) r.errors.push('"None needed" cannot be chosen with equipment.');
    const worst = Math.max(points(t, 'day', a), points(t, 'night', a));
    const needsEquip = ['three_equipment', 'bed'].includes(str(a.day)) || ['three_equipment', 'bed'].includes(str(a.night));
    if (needsEquip && (eq.length === 0 || eq.includes('none'))) r.errors.push('They need evacuation equipment by day or night: choose which.');
    let cat: 'green' | 'amber' | 'red' = worst >= 3 || eq.some(e => e !== 'none' && e !== 'wheelchair') ? 'red' : worst >= 1 ? 'amber' : 'green';
    if (cat === 'green' && (a.understands === 'may_refuse' || a.hears === 'no' || a.hears === 'alert')) cat = 'amber';
    const staff = (v: Answer) => ({ unaided: 0, aid_supervision: 1, one: 1, two: 2, three_equipment: 3, bed: 3 } as Record<string, number>)[str(v)] ?? 0;
    const staffDay = staff(a.day), staffNight = staff(a.night);
    r.level = cat === 'red' ? 'high' : cat === 'amber' ? 'medium' : 'low';
    r.storedScore = Math.max(staffDay, staffNight);
    const catLabel = cat.toUpperCase();
    const eqLabels = labelsOf(t, 'equipment', a);
    r.headline = `${catLabel} — ${cat === 'red' ? '3 or more staff, or equipment' : cat === 'amber' ? '1–2 staff, no equipment' : 'leaves unaided'}`;
    r.reasons.push(`By day: ${EVAC.find(o => o.value === str(a.day))?.label || '—'}`, `By night: ${EVAC.find(o => o.value === str(a.night))?.label || '—'}`);
    if (eqLabels.length) r.reasons.push(`Equipment: ${eqLabels.join(', ')}`);
    if (staffNight > staffDay) r.warnings.push('They need more help at night. Check night staffing can deliver this plan alongside everyone else\'s.');
    if (list(a.medical).includes('oxygen')) r.warnings.push('Oxygen: turn it off and take it away from any fire if it is safe to; tell the fire service on arrival.');
    if (list(a.medical).includes('bariatric')) r.warnings.push('Bariatric: check the evacuation equipment is rated for their weight.');
    if (a.understands === 'may_refuse') r.actions.push('Plan who stays with them, and check their room again — people with dementia may return to it.');
    if (a.hears === 'alert' || a.hears === 'no') r.actions.push(`Alert them in person${str(a.alert_how) ? `: ${str(a.alert_how)}` : ''}.`);
    r.actions.push('Add this plan to the fire grab pack, and tell night staff.');
    r.actions.push('Practise it in fire drills, and update it when anything changes.');
    r.reviewDays = 28;
    r.reviewNote = 'And whenever their mobility, room, medicines or the building changes.';
    const p = r.plan;
    p.riskLevel = r.level === 'high' ? 'high' : r.level === 'medium' ? 'medium' : 'low';
    p.need = `PEEP ${r.headline}. ${r.reasons.join('. ')}.`;
    p.outcome = 'Reaches a place of safety quickly in a fire, by day or night.';
    p.interventions = [...r.actions, ...(str(a.route) ? [`Route: ${str(a.route)}`] : []), ...(str(a.notes) ? [str(a.notes)] : [])];
    p.equipment = eqLabels;
    p.details = { peepCategory: cat, peepStaffDay: staffDay, peepStaffNight: staffNight, peepEquipment: eqLabels, peepRoute: str(a.route) || undefined, floor: str(a.floor) || undefined };
    r.facts.push(`Fire (PEEP): ${catLabel}${staffNight || staffDay ? ` — ${Math.max(staffDay, staffNight)} staff` : ''}${eqLabels.length ? ` + ${eqLabels.join(', ').toLowerCase()}` : ''}`);
    return r;
  },
};

// ── 9. Abbey Pain Scale ──────────────────────────────────────────────────────
// Abbey J et al. (2004). Same items, bands and advice as v87, now as a tool.

const ABBEY: { key: string; label: string; hint: string }[] = [
  { key: 'vocalisation', label: 'Vocalisation', hint: 'Whimpering, groaning, crying' },
  { key: 'facial', label: 'Facial expression', hint: 'Looking tense, frowning, grimacing, looking frightened' },
  { key: 'body_language', label: 'Change in body language', hint: 'Fidgeting, rocking, guarding part of the body, withdrawn' },
  { key: 'behaviour', label: 'Behavioural change', hint: 'Increased confusion, refusing to eat, change in usual patterns' },
  { key: 'physiological', label: 'Physiological change', hint: 'Temperature, pulse or blood pressure outside normal limits, sweating, flushing or pallor' },
  { key: 'physical', label: 'Physical changes', hint: 'Skin tears, pressure areas, arthritis, contractures, previous injuries' },
];
const SEV: Option[] = [
  { value: '0', label: 'Absent', points: 0 }, { value: '1', label: 'Mild', points: 1 },
  { value: '2', label: 'Moderate', points: 2 }, { value: '3', label: 'Severe', points: 3 },
];

const abbey: Tool = {
  key: 'abbey_pain', name: 'Abbey Pain Scale', shortName: 'Abbey pain', version: 'abbey-2004/cv88',
  purpose: 'Pain in someone who cannot say they are in pain, from what you can see.',
  who: 'Any trained carer or nurse who knows the person. Watch them while they move or are cared for.',
  domain: 'pain', scored: true,
  sources: [{ label: 'Abbey J et al. (2004) The Abbey pain scale', url: 'https://pubmed.ncbi.nlm.nih.gov/15115564/' }],
  sections: [
    { key: 'observe', title: 'Observe them', intro: 'Score each item while they move or are cared for.', questions: ABBEY.map(i => ({ key: i.key, label: i.label, hint: i.hint, type: 'choice' as const, options: SEV })) },
    { key: 'type', title: 'Type of pain', questions: [
      { key: 'pain_type', label: 'Type of pain', type: 'choice', optional: true, options: [
        { value: 'chronic', label: 'Chronic (long-standing)' }, { value: 'acute', label: 'Acute (new)' }, { value: 'acute_on_chronic', label: 'Acute on chronic' },
      ] },
    ] },
  ],
  evaluate(a) {
    const t = abbey;
    const r = base(t, a, t.domain);
    const total = ABBEY.reduce((s, i) => s + points(t, i.key, a), 0);
    r.score = total; r.storedScore = total; r.maxScore = 18;
    for (const i of ABBEY) { const p = points(t, i.key, a); if (p) r.reasons.push(`${i.label}: ${p}`); }
    const band = total >= 14 ? 'severe' : total >= 8 ? 'moderate' : total >= 3 ? 'mild' : 'none';
    r.level = band;
    r.headline = band === 'none' ? `No pain shown (${total})` : `${band[0].toUpperCase()}${band.slice(1)} pain (${total})`;
    r.actions.push({
      none: 'No pain shown on the scale. Keep watching: re-score if anything changes, or if the person or their family says they are in pain.',
      mild: 'Mild pain. Look for the cause, try comfort measures and any prescribed pain relief, and re-score within an hour.',
      moderate: 'Moderate pain. Give prescribed pain relief, tell the nurse in charge, and re-score within an hour. Consider asking the GP to review.',
      severe: 'Severe pain. Tell the nurse in charge now. Give prescribed pain relief and contact the GP or 111 the same day.',
    }[band]);
    if (band === 'severe') r.warnings.push('Severe pain: tell the nurse in charge now.');
    r.reviewDays = 7;
    r.reviewNote = 'Re-score an hour after any pain relief, and whenever their behaviour changes.';
    r.plan.riskLevel = band === 'none' ? 'low' : band === 'mild' ? 'medium' : 'high';
    r.plan.need = `Abbey pain score ${total} — ${band === 'none' ? 'no pain shown' : band + ' pain'}.`;
    r.plan.outcome = 'Comfortable, with pain noticed and treated quickly.';
    r.plan.interventions = ['Use the Abbey Pain Scale when they seem unsettled, and an hour after pain relief.', ...r.actions];
    r.plan.details = { painTool: 'abbey' };
    return r;
  },
};

// ── registry ─────────────────────────────────────────────────────────────────

// Grouping, and the tools only some people need (not counted as "never done").
waterlow.group = 'clinical'; must.group = 'clinical'; eating.group = 'clinical'; oral.group = 'clinical'; abbey.group = 'clinical';
falls.group = 'safety'; movingHandling.group = 'safety'; bedRails.group = 'safety'; peep.group = 'safety';
abbey.whenNeeded = 'For people who cannot say they are in pain, or when they seem unsettled.';
bedRails.whenNeeded = 'For anyone at risk of falling from bed, or who has or asks for bed rails.';

export const TOOLS: Record<ToolKey, Tool> = {
  waterlow, must, falls, moving_handling: movingHandling, bed_rails: bedRails,
  eating_drinking: eating, oral_health: oral, peep, abbey_pain: abbey,
  ...MORE_TOOLS,
};
export const TOOL_ORDER: ToolKey[] = [
  // Everyone
  'waterlow', 'must', 'falls', 'moving_handling', 'eating_drinking', 'hydration', 'oral_health', 'bowel',
  'delirium_4at', 'mood_gds15', 'personal_fire', 'peep',
  // When needed
  'bed_rails', 'behaviour_support', 'leaving_building', 'self_medication', 'wheelchair_belt',
  'catheter', 'seizure', 'emotional_safety', 'abbey_pain',
];
export function isToolKey(k: unknown): k is ToolKey { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(TOOLS, k); }

/**
 * Keep only answers to questions that exist (and are showing), coerced to the
 * question's type. What is stored is exactly what was scored.
 */
export function cleanAnswers(key: ToolKey, raw: unknown): Answers {
  return cleanAnswersFor(TOOLS[key], raw);
}

/** The same, for any tool — including the home's own (v90). */
export function cleanAnswersFor(t: Tool, raw: unknown): Answers {
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as Record<string, unknown> : {};
  const out: Answers = {};
  // Two passes so showIf sees the cleaned values.
  for (const q0 of allQuestions(t)) {
    const v = src[q0.key];
    if (v === undefined || v === null || v === '') continue;
    if (q0.type === 'multi') {
      const vals = (Array.isArray(v) ? v : [v]).map(String).filter(x => q0.options!.some(o => o.value === x));
      if (vals.length) out[q0.key] = uniq(vals);
    } else if (q0.type === 'choice') {
      if (q0.options!.some(o => o.value === String(v))) out[q0.key] = String(v);
    } else if (q0.type === 'number') {
      const n = Number(v);
      if (Number.isFinite(n)) out[q0.key] = n;
    } else if (q0.type === 'date') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) out[q0.key] = String(v);
    } else {
      out[q0.key] = String(v).slice(0, 2000);
    }
  }
  for (const q0 of allQuestions(t)) if (q0.showIf && !q0.showIf(out)) delete out[q0.key];
  return out;
}

export function evaluate(key: ToolKey, answers: Answers, ctx: Context = {}): Result {
  return TOOLS[key].evaluate(answers, ctx);
}

/** The label shown for a stored level. */
export const LEVEL_LABEL: Record<Level, string> = {
  none: 'No pain', low: 'Low', medium: 'Medium', high: 'High', very_high: 'Very high',
  mild: 'Mild', moderate: 'Moderate', severe: 'Severe', not_scored: 'Assessed',
};
