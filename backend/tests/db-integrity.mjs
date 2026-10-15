#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// Database integrity tests — run against a REAL Postgres after `npm run migrate`.
//
// The rules that make CareVista's records trustworthy live in database
// triggers, not in application code. Unit tests can't see triggers, so until
// this file existed nothing had ever proved they work. Each check here tries
// to do the forbidden thing and expects Postgres to refuse.
//
//   DATABASE_URL=... node tests/db-integrity.mjs
//
// Everything runs inside one transaction that is rolled back at the end.
// ────────────────────────────────────────────────────────────────────────────
import pg from 'pg';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let pass = 0, fail = 0, sp = 0;
const q = (sql, params) => client.query(sql, params);
async function t(name, fn) {
  const s = `t${++sp}`;
  await q(`SAVEPOINT ${s}`);
  try { await fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
  await q(`ROLLBACK TO SAVEPOINT ${s}`);
}
/** The statement must be refused, with a message matching `pattern`. */
async function refused(sql, params, pattern) {
  const s = `r${++sp}`;
  await q(`SAVEPOINT ${s}`);
  try { await q(sql, params); }
  catch (e) {
    await q(`ROLLBACK TO SAVEPOINT ${s}`);
    if (pattern && !pattern.test(e.message)) throw new Error(`refused, but with an unexpected error: ${e.message}`);
    return;
  }
  await q(`ROLLBACK TO SAVEPOINT ${s}`);
  throw new Error(`was allowed: ${sql.replace(/\s+/g, ' ').slice(0, 90)}`);
}
const hex = c => c.repeat(64);

await q('BEGIN');
try {
  const { rows: [home] } = await q('SELECT id FROM care_homes LIMIT 1');
  const { rows: [user] } = await q('SELECT id FROM users WHERE care_home_id = $1 LIMIT 1', [home.id]);
  const { rows: [res]  } = await q('SELECT id FROM residents WHERE care_home_id = $1 LIMIT 1', [home.id]);
  if (!home || !user || !res) throw new Error('Seed data missing: run npm run seed first.');

  console.log('\nMigrations');
  await t('every migration file has been applied', async () => {
    const files = readdirSync(join(here, '../migrations')).filter(f => f.endsWith('.sql'));
    const { rows } = await q('SELECT filename FROM _migrations');
    const done = new Set(rows.map(r => r.filename));
    const missing = files.filter(f => !done.has(f));
    if (missing.length) throw new Error('not applied: ' + missing.join(', '));
  });

  console.log('\nRecord chain (032)');
  const addEntry = async (seq) => (await q(
    `INSERT INTO record_chain (care_home_id, seq, entity_type, entity_id, entry_hash, hashed_fields, prev_hash, chain_hash, recorded_by)
     VALUES ($1, $2, 'care_note', gen_random_uuid(), $3, ARRAY['a'], $4, $5, $6) RETURNING id`,
    [home.id, seq, hex('a'), hex('0'), hex('b'), user.id])).rows[0].id;
  const bigSeq = 9_000_000_000;

  await t('an entry cannot be edited', async () => {
    const id = await addEntry(bigSeq);
    await refused('UPDATE record_chain SET entry_hash = $1 WHERE id = $2', [hex('c'), id], /append-only/);
  });
  await t('an entry cannot be deleted', async () => {
    const id = await addEntry(bigSeq);
    await refused('DELETE FROM record_chain WHERE id = $1', [id], /append-only/);
  });
  await t('an entry with no event time can still be anchored once, and only once', async () => {
    const id = await addEntry(bigSeq);
    const { rows: [a] } = await q(
      `INSERT INTO chain_anchors (care_home_id, anchor_date, from_seq, to_seq, entry_count, merkle_root, chain_head)
       VALUES ($1, DATE '1999-01-01', $2, $2, 1, $3, $4) RETURNING id`, [home.id, bigSeq, hex('d'), hex('b')]);
    await q('UPDATE record_chain SET anchored_in = $1 WHERE id = $2', [a.id, id]);
    await refused('UPDATE record_chain SET anchored_in = NULL WHERE id = $1', [id], /append-only/);
  });
  await t('anchoring cannot be used to smuggle in an edit', async () => {
    const id = await addEntry(bigSeq);
    const { rows: [a] } = await q(
      `INSERT INTO chain_anchors (care_home_id, anchor_date, from_seq, to_seq, entry_count, merkle_root, chain_head)
       VALUES ($1, DATE '1999-01-02', $2, $2, 1, $3, $4) RETURNING id`, [home.id, bigSeq, hex('d'), hex('b')]);
    await refused('UPDATE record_chain SET anchored_in = $1, entry_hash = $2 WHERE id = $3', [a.id, hex('e'), id], /append-only/);
  });

  console.log('\nDaily seals (032)');
  const addAnchor = async (day) => (await q(
    `INSERT INTO chain_anchors (care_home_id, anchor_date, from_seq, to_seq, entry_count, merkle_root, chain_head)
     VALUES ($1, $2::date, 1, 1, 1, $3, $4) RETURNING id`, [home.id, day, hex('d'), hex('b')])).rows[0].id;
  await t('a seal\'s root cannot be rewritten', async () => {
    const id = await addAnchor('1999-02-01');
    await refused('UPDATE chain_anchors SET merkle_root = $1 WHERE id = $2', [hex('f'), id], /cannot be rewritten/);
  });
  await t('a seal cannot be deleted', async () => {
    const id = await addAnchor('1999-02-02');
    await refused('DELETE FROM chain_anchors WHERE id = $1', [id], /append-only/);
  });
  await t('a seal can be published once, then nothing changes', async () => {
    const id = await addAnchor('1999-02-03');
    await q(`UPDATE chain_anchors SET anchor_mode = 'external', external_provider = 'test', external_receipt = '\\x00'::bytea,
             published_at = NOW() WHERE id = $1`, [id]);
    await refused(`UPDATE chain_anchors SET external_provider = 'other' WHERE id = $1`, [id], /published/);
  });
  await t('"external" without a provider and time is refused', async () => {
    const id = await addAnchor('1999-02-04');
    await refused(`UPDATE chain_anchors SET anchor_mode = 'external' WHERE id = $1`, [id], /external_has_ref|check constraint/i);
  });

  console.log('\nCapacity assessments (035)');
  const addMca = async () => (await q(
    `INSERT INTO mca_assessments (care_home_id, resident_id, decision, created_by) VALUES ($1, $2, 'Test decision', $3) RETURNING id`,
    [home.id, res.id, user.id])).rows[0].id;
  const complete = id => q(
    `UPDATE mca_assessments SET status = 'completed', outcome = 'has_capacity', completed_at = NOW(), assessor_id = $2 WHERE id = $1`,
    [id, user.id]);
  await t('a draft can be edited and deleted', async () => {
    const id = await addMca();
    await q(`UPDATE mca_assessments SET decision = 'Changed' WHERE id = $1`, [id]);
    await q('DELETE FROM mca_assessments WHERE id = $1', [id]);
  });
  await t('completing without an outcome is refused', async () => {
    const id = await addMca();
    await refused(`UPDATE mca_assessments SET status = 'completed' WHERE id = $1`, [id], /mca_completed_has_outcome|check constraint/i);
  });
  await t('a completed assessment cannot be edited', async () => {
    const id = await addMca(); await complete(id);
    await refused(`UPDATE mca_assessments SET decision = 'Rewritten' WHERE id = $1`, [id], /final/);
    await refused(`UPDATE mca_assessments SET record = '{"x":1}' WHERE id = $1`, [id], /final/);
    await refused(`UPDATE mca_assessments SET outcome = 'lacks_capacity' WHERE id = $1`, [id], /final/);
  });
  await t('a completed assessment cannot be deleted', async () => {
    const id = await addMca(); await complete(id);
    await refused('DELETE FROM mca_assessments WHERE id = $1', [id], /cannot be deleted/);
  });
  await t('a completed assessment can be superseded — and nothing else may change with it', async () => {
    const id = await addMca(); await complete(id);
    await refused(`UPDATE mca_assessments SET status = 'superseded', decision = 'x' WHERE id = $1`, [id], /final/);
    await q(`UPDATE mca_assessments SET status = 'superseded' WHERE id = $1`, [id]);
    await refused(`UPDATE mca_assessments SET status = 'completed' WHERE id = $1`, [id], /final/);
  });

  console.log('\nCare note types (033, 034)');
  await t('the database accepts every note type the app sends', async () => {
    const { rows } = await q(`
      SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = (SELECT udt_name FROM information_schema.columns
                           WHERE table_name = 'care_notes' AND column_name = 'note_type')`);
    const have = new Set(rows.map(r => r.enumlabel));
    const need = ['continence', 'wound_care', 'fall_observation', 'activities', 'end_of_life', 'handover'];
    const missing = need.filter(x => !have.has(x));
    if (missing.length) throw new Error('missing: ' + missing.join(', '));
  });
  await t('structured bowel columns exist', async () => {
    const { rows } = await q(`SELECT column_name FROM information_schema.columns
                               WHERE table_name = 'care_notes' AND column_name IN ('bowels_opened', 'stool_type')`);
    if (rows.length !== 2) throw new Error('bowels_opened / stool_type columns missing');
  });

  console.log('\nPRN follow-up (036)');
  await t('the effect of a PRN dose can be recorded once, and not rewritten', async () => {
    const { rows: [med] } = await q('SELECT id, resident_id FROM medications WHERE care_home_id = $1 LIMIT 1', [home.id]);
    if (!med) throw new Error('seed has no medications to test with');
    const { rows: [a] } = await q(
      `INSERT INTO med_administrations (care_home_id, medication_id, resident_id, administered_by, administration_date,
                                        scheduled_time, status, is_prn, prn_reason)
       VALUES ($1, $2, $3, $4, DATE '1999-03-01', TIME '14:07', 'given', TRUE, 'Pain') RETURNING id`,
      [home.id, med.id, med.resident_id, user.id]);
    await q(`UPDATE med_administrations SET prn_effect = 'Effective', prn_effect_at = NOW(), prn_effect_by = $2 WHERE id = $1`, [a.id, user.id]);
    await refused(`UPDATE med_administrations SET prn_effect = 'Not effective' WHERE id = $1`, [a.id], /already been recorded/);
    await refused(`UPDATE med_administrations SET prn_effect = NULL WHERE id = $1`, [a.id], /already been recorded/);
  });

  console.log('\nSoft signs (037)');
  const raiseAlert = async () => (await q(
    `INSERT INTO deterioration_alerts (care_home_id, resident_id, raised_by, signs, told_in_person)
     VALUES ($1, $2, $3, ARRAY['more_sleepy'], FALSE) RETURNING id`, [home.id, res.id, user.id])).rows[0].id;
  await t('what a carer raised cannot be changed afterwards', async () => {
    const id = await raiseAlert();
    await refused(`UPDATE deterioration_alerts SET signs = ARRAY['not_themselves'] WHERE id = $1`, [id], /cannot be changed/);
    await refused(`UPDATE deterioration_alerts SET told_in_person = TRUE WHERE id = $1`, [id], /cannot be changed/);
  });
  await t('an alert cannot be deleted', async () => {
    const id = await raiseAlert();
    await refused('DELETE FROM deterioration_alerts WHERE id = $1', [id], /cannot be deleted/);
  });
  await t('closing needs an outcome and a reason; after closing nothing changes', async () => {
    const id = await raiseAlert();
    await q(`UPDATE deterioration_alerts SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = NOW() WHERE id = $1`, [id, user.id]);
    await refused(`UPDATE deterioration_alerts SET status = 'closed', closed_by = $2, closed_at = NOW() WHERE id = $1`, [id, user.id], /det_closed_is_reasoned|check constraint/i);
    await refused(`UPDATE deterioration_alerts SET status = 'closed', outcome = 'no_concern', outcome_note = 'ok', closed_by = $2, closed_at = NOW() WHERE id = $1`, [id, user.id], /det_closed_is_reasoned|check constraint/i);
    await q(`UPDATE deterioration_alerts SET status = 'closed', outcome = 'news2_stable', outcome_note = 'NEWS2 0, settled', closed_by = $2, closed_at = NOW() WHERE id = $1`, [id, user.id]);
    await refused(`UPDATE deterioration_alerts SET outcome_note = 'rewritten' WHERE id = $1`, [id], /closed/);
  });
  await t('an empty list of signs is refused', async () => {
    await refused(`INSERT INTO deterioration_alerts (care_home_id, resident_id, raised_by, signs, told_in_person)
                   VALUES ($1, $2, $3, ARRAY[]::text[], FALSE)`, [home.id, res.id, user.id], /det_signs_present|check constraint/i);
  });

  console.log('\nOffline records (038)');
  const note = (clientAt, ref = null) => q(
    `INSERT INTO care_notes (care_home_id, resident_id, author_id, note_type, content, client_recorded_at, client_ref)
     VALUES ($1, $2, $3, 'personal_care', 'db test', $4, $5) RETURNING id`, [home.id, res.id, user.id, clientAt, ref]);
  await t('device time up to 72 hours old is accepted', async () => {
    await note(new Date(Date.now() - 70 * 3600_000));
  });
  await t('device time older than 72 hours is refused by the database itself', async () => {
    await refused(`INSERT INTO care_notes (care_home_id, resident_id, author_id, note_type, content, client_recorded_at)
                   VALUES ($1, $2, $3, 'personal_care', 'db test', NOW() - INTERVAL '73 hours')`, [home.id, res.id, user.id], /client_time_bounded|check constraint/i);
  });
  await t('device time in the future is refused', async () => {
    await refused(`INSERT INTO care_notes (care_home_id, resident_id, author_id, note_type, content, client_recorded_at)
                   VALUES ($1, $2, $3, 'personal_care', 'db test', NOW() + INTERVAL '1 hour')`, [home.id, res.id, user.id], /client_time_bounded|check constraint/i);
  });
  await t('the same offline note sent twice is stored once', async () => {
    const ref = '3f2b8c1e-9d4a-4c7b-8e2f-1a2b3c4d5e6f';
    await note(null, ref);
    await refused(`INSERT INTO care_notes (care_home_id, resident_id, author_id, note_type, content, client_ref)
                   VALUES ($1, $2, $3, 'personal_care', 'db test', $4)`, [home.id, res.id, user.id, ref], /duplicate key|uq_care_notes_client_ref/);
  });

  console.log('\nCare day and Abbey pain (039)');
  await t('an Abbey pain score can be stored, with its bands', async () => {
    await q(`UPDATE risk_assessments SET status = 'superseded' WHERE resident_id = $1 AND assessment_type = 'abbey_pain' AND status = 'current'`, [res.id]);
    await q(`INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors)
             VALUES ($1, $2, $3, 'abbey_pain', 9, 'moderate', '{}')`, [home.id, res.id, user.id]);
    // (040 allows one *current* per resident per tool; these rows are inserted
    // into a rolled-back savepoint, after superseding anything already current.)
  });
  await t('existing assessment types and levels still work', async () => {
    await q(`UPDATE risk_assessments SET status = 'superseded' WHERE resident_id = $1 AND assessment_type = 'waterlow' AND status = 'current'`, [res.id]);
    await q(`INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors)
             VALUES ($1, $2, $3, 'waterlow', 16, 'high', '{}')`, [home.id, res.id, user.id]);
  });
  await t('an unknown assessment type is still refused', async () => {
    await refused(`INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors)
                   VALUES ($1, $2, $3, 'made_up', 1, 'low', '{}')`, [home.id, res.id, user.id], /check constraint/i);
  });

  console.log('\nAssessments in depth (040)');
  const newAssessment = async (type = 'peep', status = 'current') => {
    await q(`UPDATE risk_assessments SET status = 'superseded' WHERE resident_id = $1 AND assessment_type = $2 AND status = 'current'`, [res.id, type]);
    return (await q(
      `INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors,
                                     answers, result, tool_version, reason, involvement, assessor_name, completed_at, status, next_review_date)
       VALUES ($1, $2, $3, $4, 2, 'not_scored', '{}', '{"day":"two"}', '{"headline":"AMBER"}', 'test/cv88', 'admission', 'With her', 'Test Nurse', NOW(), $5, CURRENT_DATE + 28)
       RETURNING id`, [home.id, res.id, user.id, type, status])).rows[0].id;
  };
  await t('all nine tool types are accepted, with "not_scored"', async () => {
    for (const ty of ['waterlow', 'must', 'falls', 'abbey_pain', 'moving_handling', 'bed_rails', 'eating_drinking', 'oral_health', 'peep']) await newAssessment(ty);
  });
  await t('a completed assessment cannot be edited — not the answers, the score or the date', async () => {
    const id = await newAssessment();
    await refused(`UPDATE risk_assessments SET answers = '{"day":"unaided"}' WHERE id = $1`, [id], /final/);
    await refused(`UPDATE risk_assessments SET total_score = 0 WHERE id = $1`, [id], /final/);
    await refused(`UPDATE risk_assessments SET next_review_date = CURRENT_DATE + 365 WHERE id = $1`, [id], /final/);
    await refused(`UPDATE risk_assessments SET result = '{}' WHERE id = $1`, [id], /final/);
  });
  await t('an assessment cannot be deleted', async () => {
    const id = await newAssessment();
    await refused(`DELETE FROM risk_assessments WHERE id = $1`, [id], /cannot be deleted/);
  });
  await t('an assessment can be superseded, but never made current again', async () => {
    const id = await newAssessment();
    await q(`UPDATE risk_assessments SET status = 'superseded' WHERE id = $1`, [id]);
    await refused(`UPDATE risk_assessments SET status = 'current' WHERE id = $1`, [id], /superseded/);
  });
  await t('two current assessments of the same tool for one person are refused', async () => {
    await newAssessment('oral_health');
    await refused(`INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors)
                   VALUES ($1, $2, $3, 'oral_health', 0, 'low', '{}')`, [home.id, res.id, user.id], /uq_risk_assessment_current|duplicate key/);
  });
  await t('a tool assessment without answers or an assessor is refused', async () => {
    await q(`UPDATE risk_assessments SET status = 'superseded' WHERE resident_id = $1 AND assessment_type = 'must' AND status = 'current'`, [res.id]);
    await refused(`INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors, tool_version)
                   VALUES ($1, $2, $3, 'must', 0, 'low', '{}', 'must/cv88')`, [home.id, res.id, user.id], /completed_whole|check constraint/i);
  });
  await t('"applied to the care plan" can be set once, not changed', async () => {
    const id = await newAssessment();
    await q(`UPDATE risk_assessments SET applied_to_plan_at = NOW() WHERE id = $1`, [id]);
    await refused(`UPDATE risk_assessments SET applied_to_plan_at = NOW() + INTERVAL '1 day' WHERE id = $1`, [id], /already recorded/);
  });
  await t('an unknown reason is refused', async () => {
    await refused(`UPDATE risk_assessments SET reason = 'because' WHERE id = (SELECT id FROM risk_assessments LIMIT 1)`, [], /reason_check|final|check constraint/i);
  });

  const { rows: [plan] } = await q(`SELECT p.id, s.id AS section_id FROM care_plans p JOIN care_plan_sections s ON s.care_plan_id = p.id LIMIT 1`);
  if (plan) {
    await t('care plan sections have structured details, defaulting to {}', async () => {
      const { rows: [s0] } = await q(`SELECT details FROM care_plan_sections WHERE id = $1`, [plan.section_id]);
      if (s0.details === null || typeof s0.details !== 'object') throw new Error('details missing');
    });
    const evalRow = async () => (await q(
      `INSERT INTO care_plan_evaluations (care_home_id, care_plan_id, section_id, resident_id, progress, note, still_right, evaluated_by, evaluator_name)
       SELECT p.care_home_id, p.id, $2, p.resident_id, 'same', 'Skin intact, no redness seen.', TRUE, $3, 'Test Nurse' FROM care_plans p WHERE p.id = $1
       RETURNING id`, [plan.id, plan.section_id, user.id])).rows[0].id;
    await t('an evaluation cannot be edited or deleted', async () => {
      const id = await evalRow();
      await refused(`UPDATE care_plan_evaluations SET note = 'rewritten later' WHERE id = $1`, [id], /cannot be changed/);
      await refused(`DELETE FROM care_plan_evaluations WHERE id = $1`, [id], /cannot be changed/);
    });
    await t('an evaluation needs a real note and a known progress', async () => {
      await refused(`INSERT INTO care_plan_evaluations (care_home_id, care_plan_id, section_id, resident_id, progress, note, still_right, evaluated_by, evaluator_name)
                     SELECT p.care_home_id, p.id, $2, p.resident_id, 'same', 'ok', TRUE, $3, 'X' FROM care_plans p WHERE p.id = $1`, [plan.id, plan.section_id, user.id], /check constraint/i);
      await refused(`INSERT INTO care_plan_evaluations (care_home_id, care_plan_id, section_id, resident_id, progress, note, still_right, evaluated_by, evaluator_name)
                     SELECT p.care_home_id, p.id, $2, p.resident_id, 'fine', 'Ten characters at least', TRUE, $3, 'X' FROM care_plans p WHERE p.id = $1`, [plan.id, plan.section_id, user.id], /check constraint/i);
    });
    await t('deleting a whole plan still cascades to its evaluations', async () => {
      await evalRow();
      // Inside the rolled-back savepoint; other tables may refuse first, which is fine — only our trigger must not.
      try { await q(`DELETE FROM care_plans WHERE id = $1`, [plan.id]); }
      catch (e) { if (/evaluation cannot be changed/.test(e.message)) throw e; }
    });
  }

  console.log('\nMore assessments and home safety (041)');
  await t('the twelve v89 assessment types are accepted', async () => {
    for (const ty of ['delirium_4at', 'mood_gds15', 'behaviour_support', 'leaving_building', 'hydration', 'self_medication',
                      'personal_fire', 'wheelchair_belt', 'bowel', 'seizure', 'catheter', 'emotional_safety']) await newAssessment(ty);
  });
  const newCheck = async (type = 'hot_water') => {
    await q(`UPDATE premises_assessments SET status = 'superseded' WHERE care_home_id = $1 AND check_type = $2 AND status = 'current'`, [home.id, type]);
    return (await q(
      `INSERT INTO premises_assessments (care_home_id, check_type, answers, result, level, failures, tool_version, next_due, assessed_by, assessor_name)
       VALUES ($1, $2, '{"tmv":"yes"}', '{"headline":"ok"}', 'low', 0, 'test/cv89', CURRENT_DATE + 31, $3, 'Test Manager') RETURNING id`,
      [home.id, type, user.id])).rows[0].id;
  };
  await t('a home safety check cannot be edited or deleted', async () => {
    const id = await newCheck();
    await refused(`UPDATE premises_assessments SET level = 'high' WHERE id = $1`, [id], /final/);
    await refused(`UPDATE premises_assessments SET next_due = CURRENT_DATE + 999 WHERE id = $1`, [id], /final/);
    await refused(`DELETE FROM premises_assessments WHERE id = $1`, [id], /cannot be deleted/);
  });
  await t('a superseded home safety check cannot become current again', async () => {
    const id = await newCheck();
    await q(`UPDATE premises_assessments SET status = 'superseded' WHERE id = $1`, [id]);
    await refused(`UPDATE premises_assessments SET status = 'current' WHERE id = $1`, [id], /superseded/);
  });
  await t('only one current check of each kind per home', async () => {
    await newCheck('legionella');
    await refused(`INSERT INTO premises_assessments (care_home_id, check_type, answers, result, level, failures, tool_version, next_due, assessed_by, assessor_name)
                   VALUES ($1, 'legionella', '{}', '{}', 'low', 0, 'x', CURRENT_DATE, $2, 'X')`, [home.id, user.id], /uq_premises_current|duplicate key/);
  });
  await t('an unknown check type or level is refused', async () => {
    await refused(`INSERT INTO premises_assessments (care_home_id, check_type, answers, result, level, failures, tool_version, next_due, assessed_by, assessor_name)
                   VALUES ($1, 'made_up', '{}', '{}', 'low', 0, 'x', CURRENT_DATE, $2, 'X')`, [home.id, user.id], /check constraint/i);
    await refused(`INSERT INTO premises_assessments (care_home_id, check_type, answers, result, level, failures, tool_version, next_due, assessed_by, assessor_name)
                   VALUES ($1, 'coshh', '{}', '{}', 'awful', 0, 'x', CURRENT_DATE, $2, 'X')`, [home.id, user.id], /check constraint/i);
  });

  console.log('\nWho is with whom (042)');
  await t('one presence row per carer per resident', async () => {
    await q(`INSERT INTO care_presence (care_home_id, resident_id, user_id, user_name, care_type) VALUES ($1,$2,$3,'Test','personal_care')`, [home.id, res.id, user.id]);
    await refused(`INSERT INTO care_presence (care_home_id, resident_id, user_id, user_name, care_type) VALUES ($1,$2,$3,'Test','nutrition')`, [home.id, res.id, user.id], /duplicate key|care_presence_pkey/);
  });

  console.log('\nThe home\'s own sections and assessments (043)');
  const DEF = JSON.stringify({ name: 'Test check', shortName: 'Test', purpose: 'Testing it works', who: 'Anyone, weekly', domain: 'safety_risk', scored: false,
    sections: [{ title: 'Q', questions: [{ key: 'q1', label: 'OK?', type: 'yesno' }] }], bands: [{ from: 0, label: 'Done', level: 'low', actions: ['None'], reviewDays: 28 }] });
  const newTool = async (status = 'published') => (await q(
    `INSERT INTO custom_assessment_tools (care_home_id, family_id, version, status, definition, created_by, published_by, published_at)
     VALUES ($1, gen_random_uuid(), 1, $2, $3, $4, $5, $6) RETURNING id, family_id`,
    [home.id, status, DEF, user.id, status === 'draft' ? null : user.id, status === 'draft' ? null : new Date()])).rows[0];
  await t('a published assessment is frozen and cannot be deleted; a draft can be', async () => {
    const p = await newTool();
    await refused(`UPDATE custom_assessment_tools SET definition = '{}' WHERE id = $1`, [p.id], /frozen/);
    await refused(`DELETE FROM custom_assessment_tools WHERE id = $1`, [p.id], /cannot be deleted/);
    const d = await newTool('draft');
    await q(`UPDATE custom_assessment_tools SET definition = '{"x":1}' WHERE id = $1`, [d.id]);
    await q(`DELETE FROM custom_assessment_tools WHERE id = $1`, [d.id]);
  });
  await t('a retired version cannot be brought back', async () => {
    const p = await newTool();
    await q(`UPDATE custom_assessment_tools SET status = 'retired' WHERE id = $1`, [p.id]);
    await refused(`UPDATE custom_assessment_tools SET status = 'published' WHERE id = $1`, [p.id], /retired/);
  });
  await t('only one live version per assessment', async () => {
    const p = await newTool();
    await refused(`INSERT INTO custom_assessment_tools (care_home_id, family_id, version, status, definition, created_by, published_by, published_at)
                   VALUES ($1, $2, 2, 'published', $3, $4, $4, NOW())`, [home.id, p.family_id, DEF, user.id], /uq_custom_tool_live|duplicate key/);
  });
  await t('a custom assessment must point at its tool; one current per resident per assessment', async () => {
    const p = await newTool();
    await refused(`INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors)
                   VALUES ($1, $2, $3, 'custom', 0, 'low', '{}')`, [home.id, res.id, user.id], /custom_link|check constraint/i);
    const ins = () => q(`INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors, custom_tool_id, custom_family_id)
                         VALUES ($1, $2, $3, 'custom', 0, 'low', '{}', $4, $5)`, [home.id, res.id, user.id, p.id, p.family_id]);
    await ins();
    const s2 = `cx${++sp}`; await q(`SAVEPOINT ${s2}`);
    let refusedDup = false;
    try { await ins(); } catch (e) { refusedDup = /uq_risk_assessment_current|duplicate key/.test(e.message); }
    await q(`ROLLBACK TO SAVEPOINT ${s2}`);
    if (!refusedDup) throw new Error('a second current custom assessment was allowed');
    // A different assessment family is independent.
    const p2 = await newTool();
    await q(`INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors, custom_tool_id, custom_family_id)
             VALUES ($1, $2, $3, 'custom', 0, 'low', '{}', $4, $5)`, [home.id, res.id, user.id, p2.id, p2.family_id]);
  });
  await t('the home\'s own sections are accepted on a care plan; made-up ones are not', async () => {
    const { rows: [pl] } = await q(`SELECT id FROM care_plans WHERE care_home_id = $1 LIMIT 1`, [home.id]);
    if (!pl) return;
    await q(`INSERT INTO care_plan_sections (care_plan_id, care_home_id, domain, sort_order) VALUES ($1,$2,'custom_ab12cd34ef',100)`, [pl.id, home.id]);
    await refused(`INSERT INTO care_plan_sections (care_plan_id, care_home_id, domain, sort_order) VALUES ($1,$2,'anything_else',101)`, [pl.id, home.id], /check constraint/i);
  });

  // @@V86@@
} finally {
  await q('ROLLBACK').catch(() => undefined);
  await client.end();
}

console.log(`\ndatabase integrity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
