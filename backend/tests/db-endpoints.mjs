#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// Every new v86–v88 endpoint, run against a REAL Postgres (CI), straight from
// the compiled controllers. Unit tests cannot catch a typo in SQL; this does.
//
//   npm run build && DATABASE_URL=... node tests/db-endpoints.mjs
// ────────────────────────────────────────────────────────────────────────────
import pg from 'pg';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = p => fileURLToPath(new URL(`../dist/${p}`, import.meta.url));
if (!existsSync(dist('controllers/pilotReport.controller.js'))) { console.error('Run npm run build first.'); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const { rows: [u] } = await c.query(`SELECT id, care_home_id, first_name, last_name, role FROM users WHERE role IN ('home_manager','super_admin') LIMIT 1`);
const { rows: [r] } = await c.query(`SELECT id FROM residents WHERE care_home_id = $1 LIMIT 1`, [u.care_home_id]);
await c.end();

let pass = 0, fail = 0;
async function call(name, handler, req, check, expectFail) {
  const out = { status: 200, body: undefined };
  const res = {
    status(s) { out.status = s; return this; },
    json(b) { out.body = b; return this; },
    send(b) { out.body = b; return this; },
    setHeader() {},
  };
  let error;
  await handler({ user: u, query: {}, params: {}, body: {}, ip: '127.0.0.1', get: () => undefined, ...req }, res, e => { error = e; });
  try {
    if (expectFail) {
      // A refusal is the point: either a 4xx response or an AppError passed on.
      const msg = error ? `${error.status || error.statusCode || ''} ${error.message}` : `${out.status} ${JSON.stringify(out.body)}`;
      if (!error && out.status < 400) throw new Error(`was allowed (status ${out.status})`);
      if (!expectFail.test(msg)) throw new Error(`refused, but not as expected: ${msg}`);
      pass++; console.log(`  ok    ${name}`); return out.body;
    }
    if (error) throw new Error(`handler failed: ${error.message}`);
    if (out.status >= 400) throw new Error(`status ${out.status}: ${JSON.stringify(out.body)}`);
    if (check) check(out.body);
    pass++; console.log(`  ok    ${name}`);
  } catch (e) { fail++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
  return out.body;
}
const imp = async p => import(dist(p));

const tasks = await imp('controllers/tasks.controller.js');
const emar = await imp('controllers/emar.controller.js');
const weight = await imp('controllers/weight.controller.js');
const det = await imp('controllers/deterioration.controller.js');
const pilot = await imp('controllers/pilotReport.controller.js');
const integ = await imp('controllers/integrity.controller.js');
const plans = await imp('controllers/carePlans.controller.js');

await call('tasks for today (UK date, UK due times)', tasks.listTasks, {}, b => { if (!Array.isArray(b)) throw new Error('not a list'); });
await call('eMAR for today, with PRN doses listed', emar.getEmar, {}, b => { if (!Array.isArray(b.medications)) throw new Error('no medications'); });
await call('PRN follow-ups', emar.listPrnFollowups, {}, b => { if (!Array.isArray(b)) throw new Error('not a list'); });
await call('weight trends for every resident', weight.getWeightTrends, {}, b => {
  if (!Array.isArray(b)) throw new Error('not a list');
  if (b[0] && !Array.isArray(b[0].readings)) throw new Error('readings is not a list');
});
await call('soft-signs alerts (open)', det.listAlerts, { query: { status: 'open' } }, b => { if (!Array.isArray(b)) throw new Error('not a list'); });
await call('soft-signs alerts (all, one resident)', det.listAlerts, { query: { status: 'all', residentId: r.id } });
await call('pilot report, two periods', pilot.pilotReport,
  { query: { baselineFrom: '2026-01-01', baselineTo: '2026-01-31', pilotFrom: '2026-02-01', pilotTo: '2026-02-28' } },
  b => { if (!Array.isArray(b.rows) || b.rows.length < 10) throw new Error('rows missing'); });
await call('integrity: list seals', integ.listAnchors, {});
await call('care plan for a resident, with its day and linked assessments', plans.getResidentPlan, { params: { residentId: r.id } });
await call('integrity: findings detection over 7 days (offline-aware SQL)', integ.runDetection, { query: { days: '7' } });

// ── v88: assessments ────────────────────────────────────────────────────────
const assess = await imp('controllers/assessments.controller.js');
await call('assessment register: every resident × nine tools', assess.getRegister, {}, b => {
  if (!Array.isArray(b.residents) || b.tools.length !== 9) throw new Error('bad register');
});
await call('PEEP register (fire grab sheet)', assess.getPeepRegister, {}, b => { if (!Array.isArray(b.residents)) throw new Error('no residents'); });
await call('assessment context from the record (age, weights, medicines)', assess.getContext, { params: { residentId: r.id } }, b => {
  if (!('weightKg' in b) || !Array.isArray(b.medicines)) throw new Error('context incomplete');
});
await call('assessments for one resident (current + history, incl. pre-v88 rows)', assess.getResidentAssessments, { params: { residentId: r.id } }, b => {
  if (!Array.isArray(b.history)) throw new Error('no history');
});
await call('"know before you help" facts for a resident', plans.getResidentFacts, { params: { residentId: r.id } }, b => {
  if (!Array.isArray(b.facts)) throw new Error('no facts');
});

// ── v89: home safety ───────────────────────────────────────────────────────
const homeSafety = await imp('controllers/homeSafety.controller.js');
await call('home safety overview: eleven checks, with PEEP context', homeSafety.getHomeSafety, {}, b => {
  if (!Array.isArray(b.checks) || b.checks.length !== 11 || typeof b.context.residents !== 'number') throw new Error('bad overview');
});
await call('assessment register lists "when needed" tools and linked records', assess.getRegister, {}, b => {
  if (!Array.isArray(b.whenNeeded) || !b.whenNeeded.includes('catheter')) throw new Error('no whenNeeded');
  if (b.residents[0] && typeof b.residents[0].linked !== 'object') throw new Error('no linked');
});
await call('assessment context includes bowels and DoLS (v89)', assess.getContext, { params: { residentId: r.id } }, b => {
  if (!('lastBowelOpenedDays' in b) || !('dolsStatus' in b)) throw new Error('context incomplete');
});

// Writes only against the throwaway CI database: assessments and evaluations
// are append-only by design, so anything written here is permanent.
const host = (() => { try { return new URL(process.env.DATABASE_URL).hostname; } catch { return ''; } })();
if (process.env.CV_ALLOW_TEST_WRITES === '1' && ['localhost', '127.0.0.1', 'postgres'].includes(host)) {
  const W = { build: 'below', sex: 'female', age: '81+', skin: ['dry'], continence: 'both', mobility: 'chairbound', lost_weight: 'no', eating_poorly: 'no', tissue: ['none'], neuro: 'none', surgery: 'none', medication: 'no' };
  const base = { residentId: r.id, type: 'waterlow', reason: 'scheduled', involvement: 'Talked it through with her; daughter present' };
  await call('an incomplete assessment is refused (422) with what is missing', assess.createAssessment, { body: { ...base, answers: { build: 'below' } } }, null, /422|not answered/);
  await call('an assessment without the person\'s involvement is refused', assess.createAssessment, { body: { ...base, involvement: '', answers: W } }, null, /involved/);
  // female 2 + 81+ 5 + below 3 + dry 1 + doubly incontinent 3 + chairbound 5 = 19: high, 4-hourly.
  const first = await call('Waterlow saved, scored by the server (19, high, 4-hourly)', assess.createAssessment, { body: { ...base, answers: W } }, b => {
    if (b.level !== 'high' || b.score !== 19 || b.result.plan.details.repositionHours !== 4) throw new Error(JSON.stringify({ level: b.level, score: b.score }));
  });
  const second = await call('a reassessment supersedes the last one', assess.createAssessment, { body: { ...base, answers: { ...W, mobility: 'fully' } } }, b => {
    if (b.supersedesId !== first?.id) throw new Error('did not supersede');
  });
  await call('only one current Waterlow remains', assess.getResidentAssessments, { params: { residentId: r.id } }, b => {
    if (b.current.waterlow?.id !== second?.id) throw new Error('current is not the newest');
    const old = b.history.find(x => x.id === first?.id);
    if (!old || old.status !== 'superseded') throw new Error('old one not superseded');
  });
  await call('falls (multifactorial) is stored with no risk score', assess.createAssessment, { body: { ...base, type: 'falls', answers: Object.fromEntries(['history','fear','mobility','medicines','postural','cognition','continence','vision','feet','conditions','environment','injury'].map(k => [k, 'no'])) } }, b => {
    if (b.level !== 'not_scored') throw new Error(b.level);
  });
  await call('a 4AT is saved and scored by the server', assess.createAssessment, { body: { ...base, type: 'delirium_4at', answers: { alertness: '0', amt4: '2', months: '1', acute: '4' } } }, b => {
    if (b.score !== 7 || b.level !== 'high') throw new Error(JSON.stringify({ score: b.score, level: b.level }));
  });
  await call('a home safety check is saved, with failures ranked', homeSafety.createHomeCheck, { body: { type: 'coshh', answers: { inventory: 'yes', locked: 'yes', trolleys: 'yes', thickener: 'no', other: 'yes', ppe: 'yes' } } }, b => {
    if (b.level !== 'high' || b.result.failures[0].severity !== 'critical') throw new Error(JSON.stringify(b.result));
  });
  await call('an incomplete home safety check is refused', homeSafety.createHomeCheck, { body: { type: 'coshh', answers: {} } }, null, /422|not answered/);
  // ── v89b: two carers saving at the same moment ──
  const notesCtrl = await imp('controllers/careNotes.controller.js');
  const raw = async (handler, req) => {
    const out = { status: 200, body: undefined, error: undefined };
    const res = { status(s) { out.status = s; return this; }, json(b) { out.body = b; return this; }, send(b) { out.body = b; return this; }, setHeader() {} };
    await handler({ user: u, query: {}, params: {}, body: {}, ip: '127.0.0.1', get: () => undefined, ...req }, res, e => { out.error = e; });
    if (out.error) out.status = out.error.statusCode || out.error.status || 500;
    return out;
  };
  // A fresh resident with no notes, so nothing seeded today can interfere.
  const cR = new pg.Client({ connectionString: process.env.DATABASE_URL }); await cR.connect();
  const { rows: [raceRes] } = await cR.query(
    `INSERT INTO residents (care_home_id, first_name, last_name, date_of_birth, room_number, admission_date)
     VALUES ($1, 'Race', 'Test', '1940-01-01', 'RT', CURRENT_DATE) RETURNING id`, [u.care_home_id]);
  const { rows: [raceTask] } = await cR.query(
    `INSERT INTO care_tasks (care_home_id, resident_id, task_date, task_name, status, note_type)
     VALUES ($1, $2, CURRENT_DATE, 'Reposition', 'pending', 'repositioning') RETURNING id, resident_id`, [u.care_home_id, raceRes.id]);
  await cR.end();
  {
    const content = `Race test ${Date.now()}: washed and dressed`;
    const body = { residentId: raceRes.id, noteType: 'personal_care', content };
    const both = await Promise.all([raw(notesCtrl.createNote, { body }), raw(notesCtrl.createNote, { body })]);
    const codes = both.map(x => x.status).sort();
    const c3 = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c3.connect();
    const { rows: [{ n }] } = await c3.query(`SELECT COUNT(*)::int AS n FROM care_notes WHERE resident_id = $1 AND content = $2`, [raceRes.id, content]);
    await c3.end();
    if (codes[0] === 201 && codes[1] === 409 && n === 1) { pass++; console.log('  ok    two carers saving the same care at the same moment: one saved, one asked (409)'); }
    else { fail++; console.error(`  FAIL  simultaneous notes: statuses ${codes.join(',')}, notes saved ${n}`); }
  }
  {
    const tasksCtrl = await imp('controllers/tasks.controller.js');
    const c4 = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c4.connect();
    const task = raceTask;
    if (!task) { console.log('  (no open task to race on — skipped)'); }
    else {
      const content = `Race test task ${Date.now()}: repositioned left side`;
      const body = { notes: 'x', note: { noteType: 'repositioning', content } };
      const both = await Promise.all([raw(tasksCtrl.completeTask, { params: { id: task.id }, body }), raw(tasksCtrl.completeTask, { params: { id: task.id }, body })]);
      const codes = both.map(x => x.status).sort();
      const { rows: [{ n }] } = await c4.query(`SELECT COUNT(*)::int AS n FROM care_notes WHERE content = $1`, [content]);
      const loser = both.find(x => x.status === 409)?.body;
      if (codes[0] === 200 && codes[1] === 409 && n === 1 && loser?.conflict === 'already_completed' && loser?.hadNote) {
        pass++; console.log('  ok    two carers completing the same task with a note: one note, the other told who did it');
      } else { fail++; console.error(`  FAIL  simultaneous task completion: statuses ${codes.join(',')}, notes saved ${n}, conflict ${loser?.conflict}`); }
      const again = await raw(tasksCtrl.completeTask, { params: { id: task.id }, body: { ...body, confirmDuplicate: true, note: { ...body.note, content: content + ' (different care)' } } });
      if (again.status === 200 && again.body?.alreadyCompleted) { pass++; console.log('  ok    "save anyway" on a finished task saves the note only'); }
      else { fail++; console.error(`  FAIL  save-anyway: ${again.status} ${JSON.stringify(again.body)}`); }
    }
    await c4.end();
  }
  // ── v90: the home's own section, field and assessment, end to end ──
  {
    const cc = await imp('controllers/customisation.controller.js');
    const sec = await raw(cc.createSectionType, { body: { label: `Stoma care ${Date.now()}`, hint: 'Appliance, size, skin', icon: 'droplets', noteType: 'personal_care', addToNewPlans: false } });
    const fld = sec.body && await raw(cc.createField, { body: { domain: sec.body.domain_key, definition: { label: 'Appliance', type: 'select', options: ['One-piece', 'Two-piece'], fact: true, tone: 'amber' } } });
    if (sec.status === 201 && fld?.status === 201 && fld.body.key === 'x_appliance') { pass++; console.log('  ok    the home\'s own section and a field on it'); }
    else { fail++; console.error(`  FAIL  custom section/field: ${sec.status} ${JSON.stringify(sec.body)} ${fld?.status} ${JSON.stringify(fld?.body)}`); }
    const def = { name: 'Stoma check', shortName: 'Stoma', purpose: 'Whether the stoma is healthy', who: 'A nurse, weekly', domain: sec.body?.domain_key || 'safety_risk', scored: true,
      sections: [{ title: 'Look', questions: [{ key: 'colour', label: 'Colour', type: 'choice', options: [{ value: 'pink', label: 'Pink', points: 0 }, { value: 'dark', label: 'Dark', points: 5, alert: 'Tell the nurse now' }] }] }],
      bands: [{ from: 0, label: 'Healthy', level: 'low', actions: ['Routine care'], reviewDays: 7 }, { from: 5, label: 'Urgent', level: 'high', actions: ['Stoma nurse today'], reviewDays: 1 }] };
    const draft = await raw(cc.createCustomTool, { body: { definition: def } });
    const pub = draft.body && await raw(cc.publishCustomTool, { params: { id: draft.body.id } });
    if (pub?.status === 200 && pub.body.status === 'published') { pass++; console.log('  ok    a home assessment is checked and published'); }
    else { fail++; console.error(`  FAIL  publish: ${pub?.status} ${JSON.stringify(pub?.body)}`); }
    const key = `custom:${draft.body?.familyId}`;
    const done = await raw(assess.createAssessment, { body: { residentId: raceRes.id, type: key, reason: 'scheduled', involvement: 'With them', answers: { colour: 'dark' } } });
    if (done.status === 201 && done.body.level === 'high' && done.body.type === key && done.body.result.warnings.includes('Tell the nurse now')) { pass++; console.log('  ok    a home assessment is scored by the server, at its exact version'); }
    else { fail++; console.error(`  FAIL  custom assessment: ${done.status} ${JSON.stringify(done.body)}`); }
    const one = done.body?.id && await raw(assess.getAssessment, { params: { id: done.body.id } });
    if (one?.body?.customDefinition?.name === 'Stoma check') { pass++; console.log('  ok    a completed home assessment comes back with the version it used'); }
    else { fail++; console.error('  FAIL  custom definition not returned'); }
    const nv = pub?.body && await raw(cc.newCustomToolVersion, { params: { id: pub.body.id } });
    const pub2 = nv?.body && await raw(cc.publishCustomTool, { params: { id: nv.body.id } });
    const list = await raw(cc.listCustomTools, {});
    const fam = list.body?.families?.find((f) => f.familyId === draft.body?.familyId);
    if (pub2?.status === 200 && fam?.live?.version === 2 && fam.versions.some((v) => v.version === 1 && v.status === 'retired')) { pass++; console.log('  ok    a new version goes live and the old one is retired, not changed'); }
    else { fail++; console.error(`  FAIL  versions: ${JSON.stringify(fam)}`); }
    const reg = await raw(assess.getRegister, {});
    if (reg.body?.tools?.includes(key)) { pass++; console.log('  ok    the register has a column for it'); } else { fail++; console.error('  FAIL  register column missing'); }
  }
  const { rows: [hasPlan] } = await (async () => { const c2 = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c2.connect(); try { return await c2.query(`SELECT id FROM care_plans WHERE resident_id = $1 AND status IN ('draft','active','under_review') LIMIT 1`, [r.id]); } finally { await c2.end(); } })();
  if (hasPlan && second) {
    await call('apply the assessment to the care plan, with two times on their day', assess.applyToPlan, { params: { id: second.id }, body: { scheduleIdx: [0, 1] } }, b => {
      if (!b.applied.includes('details')) throw new Error(JSON.stringify(b));
    });
    await call('the plan now carries the facts carers see', plans.getResidentFacts, { params: { residentId: r.id } }, b => {
      if (b.source !== 'plan') throw new Error('not from the plan');
    });
    const plan = await call('care plan loads with details, evaluations and assessments', plans.getPlan, { params: { id: hasPlan.id } }, b => {
      const skin = b.sections.find(s => s.domain === 'skin_integrity');
      if (!skin || skin.details.repositionHours === undefined || !Array.isArray(skin.evaluations) || !Array.isArray(b.facts)) throw new Error('shape');
    });
    const skin = plan?.sections?.find(s => s.domain === 'skin_integrity');
    if (skin) await call('a need can be evaluated', plans.addEvaluation, { params: { id: hasPlan.id, sectionId: skin.id }, body: { progress: 'same', note: 'Skin intact, heels checked twice daily.', stillRight: true } });
  } else {
    await call('apply without a care plan is refused with a clear reason', assess.applyToPlan, { params: { id: second?.id } }, null, /care plan/);
  }
} else {
  console.log('  (write checks skipped: set CV_ALLOW_TEST_WRITES=1 against a throwaway local database)');
}

// Only reads (and the findings detector) run here: the new tables refuse
// deletes by design, so test writes would be permanent. The write paths are
// covered at the SQL level by db-integrity.mjs, inside a rolled-back transaction.
console.log(`\nendpoints against Postgres: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
