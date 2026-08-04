// ============================================================
// src/utils/seed-demo.ts  --  DEMO DATA SEED (migrations 005-014)
// Populates all tables from migrations 005-014 with 30 days of
// realistic demo data. Run AFTER the main seed.ts.
// ============================================================

import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || /sslmode=require/.test(process.env.DATABASE_URL || '') || process.env.PGSSL === 'true') ? { rejectUnauthorized: false } : false,
});

// -- Helpers ------------------------------------------------------------------
function daysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); return d;
}
function daysFromNow(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() + n); return d;
}
function dateStr(d: Date): string { return d.toISOString().slice(0, 10); }
function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function timeStr(d: Date): string { return d.toISOString(); }

// -- Main seed function -------------------------------------------------------
async function seedDemo() {
  const client = await pool.connect();
  const counts: Record<string, number> = {};

  function track(table: string, n: number = 1) {
    counts[table] = (counts[table] || 0) + n;
  }

  try {
    console.log('🌱  Starting DEMO data seed (migrations 005-014)...\n');

    // -- Look up existing IDs from the main seed ---------------------------------
    const { rows: [homeRow] } = await client.query(
      `SELECT id FROM care_homes WHERE email = 'admin@willowbrook.carevista.co.uk' LIMIT 1`
    );
    if (!homeRow) {
      console.error('ERROR: Main seed has not been run. Run `npm run seed` first.');
      process.exit(1);
    }
    const homeId = homeRow.id;

    // -- Idempotency guard: skip if demo data already seeded -----------------
    const { rows: existingQr } = await client.query(
      `SELECT id FROM qr_room_codes WHERE care_home_id = $1 LIMIT 1`,
      [homeId]
    );
    if (existingQr.length > 0) {
      console.log('⚠️  Demo data already seeded — skipping. Drop & recreate DB to re-seed.');
      return;
    }

    // Users
    const userEmails = [
      'manager@demo.carevista.co.uk', 'deputy@demo.carevista.co.uk',
      'nurse@demo.carevista.co.uk', 'senior@demo.carevista.co.uk',
      'carer1@demo.carevista.co.uk', 'carer2@demo.carevista.co.uk',
      'activities@demo.carevista.co.uk', 'finance@demo.carevista.co.uk',
      'cleaning@demo.carevista.co.uk', 'kitchen@demo.carevista.co.uk',
      'maintenance@demo.carevista.co.uk',
    ];
    const userIds: Record<string, string> = {};
    for (const email of userEmails) {
      const { rows } = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
      if (rows.length > 0) userIds[email] = rows[0].id;
    }
    const managerId = userIds['manager@demo.carevista.co.uk'];
    const deputyId = userIds['deputy@demo.carevista.co.uk'];
    const nurseId = userIds['nurse@demo.carevista.co.uk'];
    const seniorId = userIds['senior@demo.carevista.co.uk'];
    const carer1Id = userIds['carer1@demo.carevista.co.uk'];
    const carer2Id = userIds['carer2@demo.carevista.co.uk'];
    const activitiesId = userIds['activities@demo.carevista.co.uk'];
    const financeId = userIds['finance@demo.carevista.co.uk'];
    const cleaningId = userIds['cleaning@demo.carevista.co.uk'];
    const kitchenId = userIds['kitchen@demo.carevista.co.uk'];
    const maintenanceId = userIds['maintenance@demo.carevista.co.uk'];
    const allStaffIds = Object.values(userIds);
    const clinicalStaff = [managerId, deputyId, nurseId, seniorId, carer1Id, carer2Id];

    // Residents by room
    const residentIds: Record<string, string> = {};
    for (let room = 1; room <= 24; room++) {
      const { rows } = await client.query(
        `SELECT id FROM residents WHERE care_home_id = $1 AND room_number = $2 LIMIT 1`,
        [homeId, String(room)]
      );
      if (rows.length > 0) residentIds[String(room)] = rows[0].id;
    }
    const allResidentIds = Object.values(residentIds);

    // Medications (for interaction checker)
    const { rows: medRows } = await client.query(
      `SELECT id, name FROM medications WHERE care_home_id = $1 LIMIT 20`, [homeId]
    );
    const medicationIds = medRows.map((r: { id: string }) => r.id);

    const highRiskRooms = ['2', '4', '8', '10', '14', '20', '24'];
    const diabeticRooms = ['1', '5', '19', '21'];
    const palliativeRooms = ['20', '24'];
    const dementiaRooms = ['2', '3', '8', '12', '16', '22'];
    const incontinenceRooms = ['8', '10', '14', '20', '22'];

    await client.query('BEGIN');

    // =========================================================================
    // MIGRATION 005: NOTIFICATIONS
    // =========================================================================
    console.log('  >  Notifications...');
    const notifTypes = [
      'medication_due', 'fall_alert', 'training_expiry', 'visitor_arrived',
      'task_overdue', 'care_plan_review', 'incident_reported', 'shift_change',
    ];
    const notifTitles: Record<string, string[]> = {
      medication_due: ['Medication round due', 'PRN medication request'],
      fall_alert: ['Fall detected in Room {room}', 'Unwitnessed fall reported'],
      training_expiry: ['Fire Safety training expiring', 'Manual Handling renewal due'],
      visitor_arrived: ['Family visitor signed in', 'GP visiting Room {room}'],
      task_overdue: ['Personal care task overdue', 'Fluid chart not updated'],
      care_plan_review: ['Monthly care plan review due', 'Risk assessment overdue'],
      incident_reported: ['New incident logged', 'Medication error reported'],
      shift_change: ['Shift swap request', 'Overtime available tomorrow'],
    };
    for (let i = 0; i < 60; i++) {
      const type = rand(notifTypes);
      const title = rand(notifTitles[type]).replace('{room}', String(randInt(1, 24)));
      const userId = rand(allStaffIds);
      const createdAt = daysAgo(randInt(0, 30));
      const isRead = Math.random() > 0.4;
      await client.query(
        `INSERT INTO notifications (care_home_id, user_id, type, title, body, priority, read_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [homeId, userId, type, title, `Auto-generated notification for demo.`,
         rand(['low', 'normal', 'high']),
         isRead ? timeStr(new Date(createdAt.getTime() + randInt(60, 3600) * 1000)) : null,
         timeStr(createdAt)]
      );
      track('notifications');
    }

    // =========================================================================
    // MIGRATION 010: NEWS2 ASSESSMENTS & ESCALATIONS
    // =========================================================================
    console.log('  >  NEWS2 assessments & escalations...');
    for (const room of highRiskRooms) {
      const resId = residentIds[room];
      if (!resId) continue;
      const numAssessments = randInt(2, 4);
      for (let i = 0; i < numAssessments; i++) {
        const dayOffset = randInt(0, 29);
        const totalScore = randInt(3, 12);
        const riskLevel = totalScore >= 9 ? 'critical' : totalScore >= 7 ? 'high' : totalScore >= 5 ? 'medium' : 'low';
        const { rows: [assess] } = await client.query(
          `INSERT INTO news2_assessments (care_home_id, resident_id, assessed_by,
            respiratory_rate, spo2, supplemental_oxygen, systolic_bp, pulse,
            consciousness, temperature, total_score, risk_level, notes, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [homeId, resId, rand(clinicalStaff),
           randInt(12, 25), randInt(88, 99), Math.random() > 0.7,
           randInt(90, 160), randInt(55, 110),
           rand(['alert', 'confusion', 'voice']),
           (36 + Math.random() * 2.5).toFixed(1),
           totalScore, riskLevel,
           'Routine NEWS2 observation completed.',
           timeStr(daysAgo(dayOffset))]
        );
        track('news2_assessments');

        if (totalScore >= 7) {
          await client.query(
            `INSERT INTO news2_escalations (care_home_id, assessment_id, resident_id,
              escalation_level, action_taken, responded_by, responded_at, status, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [homeId, assess.id, resId, riskLevel,
             riskLevel === 'critical' ? 'GP called, 999 on standby' : 'Senior nurse informed',
             nurseId, timeStr(daysAgo(dayOffset)),
             rand(['acknowledged', 'resolved']),
             timeStr(daysAgo(dayOffset))]
          );
          track('news2_escalations');
        }
      }
    }

    // =========================================================================
    // MIGRATION 010: WOUND ASSESSMENTS
    // =========================================================================
    console.log('  >  Wound assessments...');
    const woundRooms = ['4', '8', '10', '14', '20'];
    const woundTypes = ['pressure_ulcer', 'skin_tear', 'surgical_wound', 'leg_ulcer'];
    const bodyAreas = ['Sacrum', 'Left heel', 'Right hip', 'Lower leg', 'Elbow'];
    for (const room of woundRooms) {
      const resId = residentIds[room];
      if (!resId) continue;
      const numWounds = randInt(1, 2);
      for (let w = 0; w < numWounds; w++) {
        const startDay = randInt(10, 28);
        for (let assess = 0; assess < randInt(2, 3); assess++) {
          const dayOffset = startDay - assess * 7;
          if (dayOffset < 0) continue;
          await client.query(
            `INSERT INTO wound_assessments (care_home_id, resident_id, assessed_by,
              wound_type, location_body_area, width_mm, height_mm, depth_mm,
              wound_bed, exudate_level, pain_level, status, notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [homeId, resId, rand(clinicalStaff),
             rand(woundTypes), rand(bodyAreas),
             (15 - assess * 3 + Math.random() * 5).toFixed(1),
             (12 - assess * 2 + Math.random() * 4).toFixed(1),
             (3 - assess * 0.5 + Math.random()).toFixed(1),
             rand(['granulating', 'epithelialising', 'sloughy']),
             rand(['none', 'low', 'moderate']),
             randInt(1, 6),
             assess === 0 ? 'active' : rand(['active', 'healing']),
             'Wound measured and dressed. Barrier cream applied.',
             timeStr(daysAgo(dayOffset))]
          );
          track('wound_assessments');
        }
      }
    }

    // =========================================================================
    // MIGRATION 010: INFECTION OUTBREAKS & CASES
    // =========================================================================
    console.log('  >  Infection outbreaks & cases...');
    const { rows: [outbreak1] } = await client.query(
      `INSERT INTO infection_outbreaks (care_home_id, outbreak_type, start_date, end_date,
        status, affected_count, isolation_protocol, notes, reported_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [homeId, 'Norovirus', dateStr(daysAgo(25)), dateStr(daysAgo(15)),
       'resolved', 4, 'Full barrier nursing, cohort isolation, enhanced cleaning protocol.',
       'Outbreak contained after 10 days. PHE notified.', nurseId, timeStr(daysAgo(25))]
    );
    track('infection_outbreaks');

    const { rows: [outbreak2] } = await client.query(
      `INSERT INTO infection_outbreaks (care_home_id, outbreak_type, start_date,
        status, affected_count, isolation_protocol, notes, reported_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [homeId, 'UTI cluster', dateStr(daysAgo(5)),
       'active', 3, 'Enhanced hydration monitoring, urine dip all at-risk residents.',
       'Cluster identified - monitoring closely.', nurseId, timeStr(daysAgo(5))]
    );
    track('infection_outbreaks');

    const outbreakCases = [
      { outbreak: outbreak1.id, rooms: ['8', '10', '14', '22'], start: 25 },
      { outbreak: outbreak2.id, rooms: ['9', '11', '15'], start: 5 },
    ];
    for (const oc of outbreakCases) {
      for (const room of oc.rooms) {
        const resId = residentIds[room];
        if (!resId) continue;
        await client.query(
          `INSERT INTO infection_cases (care_home_id, outbreak_id, resident_id,
            symptoms, onset_date, isolation_start, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [homeId, oc.outbreak, resId,
           oc.start === 25 ? 'Vomiting, diarrhoea, nausea' : 'Dysuria, frequency, confusion',
           dateStr(daysAgo(oc.start - randInt(0, 2))),
           dateStr(daysAgo(oc.start)),
           oc.start === 25 ? 'resolved' : 'active',
           timeStr(daysAgo(oc.start))]
        );
        track('infection_cases');
      }
    }

    // =========================================================================
    // MIGRATION 010: CONTINENCE LOGS & ASSESSMENTS
    // =========================================================================
    console.log('  >  Continence logs & assessments...');
    const eventTypes = [
      'continent', 'incontinent_urine', 'incontinent_faeces', 'pad_change',
      'toileted_successfully', 'toileted_unsuccessfully',
    ];
    for (const room of incontinenceRooms) {
      const resId = residentIds[room];
      if (!resId) continue;
      for (let day = 0; day < 30; day++) {
        const logsPerDay = randInt(3, 5);
        for (let l = 0; l < logsPerDay; l++) {
          const eventTime = new Date(daysAgo(day));
          eventTime.setHours(randInt(6, 22), randInt(0, 59));
          await client.query(
            `INSERT INTO continence_logs (care_home_id, resident_id, logged_by,
              event_type, event_time, pad_status, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [homeId, resId, rand(clinicalStaff),
             rand(eventTypes), timeStr(eventTime),
             rand(['dry', 'wet', 'soiled', 'not_applicable']),
             timeStr(eventTime)]
          );
          track('continence_logs');
        }
      }
      // Assessment
      await client.query(
        `INSERT INTO continence_assessments (care_home_id, resident_id, assessed_by,
          pattern_analysis, recommended_schedule, pad_type, current_pad_usage,
          target_pad_usage, dignity_notes, review_date, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [homeId, resId, nurseId,
         JSON.stringify({ peak_times: ['07:00', '11:00', '15:00', '20:00'] }),
         JSON.stringify({ prompted_voiding: '2-hourly during day' }),
         rand(['Light pad', 'Medium pad', 'Night pad']),
         randInt(4, 8), randInt(3, 5),
         'Maintain dignity at all times. Use preferred terminology.',
         dateStr(daysFromNow(30)), timeStr(daysAgo(7))]
      );
      track('continence_assessments');
    }

    // =========================================================================
    // MIGRATION 010: ROTA TEMPLATES & SHIFTS
    // =========================================================================
    console.log('  >  Rota templates & shifts...');
    const today = new Date();
    const mondayThisWeek = new Date(today);
    mondayThisWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const mondayNextWeek = new Date(mondayThisWeek);
    mondayNextWeek.setDate(mondayThisWeek.getDate() + 7);

    const { rows: [rota1] } = await client.query(
      `INSERT INTO rota_templates (care_home_id, name, week_start, status, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [homeId, 'Week ' + dateStr(mondayThisWeek), dateStr(mondayThisWeek),
       'published', managerId, timeStr(daysAgo(7))]
    );
    track('rota_templates');

    const { rows: [rota2] } = await client.query(
      `INSERT INTO rota_templates (care_home_id, name, week_start, status, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [homeId, 'Week ' + dateStr(mondayNextWeek), dateStr(mondayNextWeek),
       'draft', managerId, timeStr(daysAgo(1))]
    );
    track('rota_templates');

    const shiftDefs = [
      { type: 'early', start: '07:00', end: '15:00' },
      { type: 'late', start: '14:00', end: '22:00' },
      { type: 'night', start: '21:30', end: '07:30' },
    ];
    for (const templateId of [rota1.id, rota2.id]) {
      for (let dayOff = 0; dayOff < 7; dayOff++) {
        const shiftDate = new Date(templateId === rota1.id ? mondayThisWeek : mondayNextWeek);
        shiftDate.setDate(shiftDate.getDate() + dayOff);
        for (const staff of clinicalStaff) {
          const shift = rand(shiftDefs);
          await client.query(
            `INSERT INTO rota_shifts (care_home_id, template_id, staff_id,
              shift_date, shift_type, start_time, end_time, role_required, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [homeId, templateId, staff,
             dateStr(shiftDate), shift.type, shift.start, shift.end,
             rand(['nurse', 'senior_carer', 'carer']),
             timeStr(daysAgo(templateId === rota1.id ? 7 : 1))]
          );
          track('rota_shifts');
        }
      }
    }

    // =========================================================================
    // MIGRATION 010: RISK ASSESSMENTS
    // =========================================================================
    console.log('  >  Risk assessments...');
    const riskTypes: Array<'waterlow' | 'must' | 'falls'> = ['waterlow', 'must', 'falls'];
    for (let room = 1; room <= 24; room++) {
      const resId = residentIds[String(room)];
      if (!resId) continue;
      const isHighRisk = highRiskRooms.includes(String(room));
      for (const assessType of riskTypes) {
        const score = isHighRisk ? randInt(12, 20) : randInt(2, 10);
        const level = score >= 15 ? 'very_high' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low';
        await client.query(
          `INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by,
            assessment_type, total_score, risk_level, factors, next_review_date, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [homeId, resId, rand(clinicalStaff),
           assessType, score, level,
           JSON.stringify({ mobility: randInt(1, 4), nutrition: randInt(1, 3), skin: randInt(1, 4) }),
           dateStr(daysFromNow(randInt(14, 60))), 'current',
           timeStr(daysAgo(randInt(5, 25)))]
        );
        track('risk_assessments');
      }
    }

    // =========================================================================
    // MIGRATION 010: MEDICATION INTERACTIONS
    // =========================================================================
    console.log('  >  Medication interactions...');
    if (medicationIds.length >= 4) {
      const interactions = [
        { resRoom: '2', medA: 0, medB: 1, severity: 'major', desc: 'CNS depression risk with concurrent use', status: 'active' },
        { resRoom: '1', medA: 2, medB: 3, severity: 'moderate', desc: 'May reduce efficacy of antihypertensive', status: 'acknowledged' },
        { resRoom: '4', medA: 0, medB: 3, severity: 'major', desc: 'Increased sedation risk', status: 'active' },
        { resRoom: '8', medA: 1, medB: 2, severity: 'minor', desc: 'Monitor for additive effects', status: 'resolved' },
      ];
      for (const inter of interactions) {
        const resId = residentIds[inter.resRoom];
        if (!resId) continue;
        await client.query(
          `INSERT INTO medication_interactions (care_home_id, resident_id, medication_a_id,
            medication_b_id, severity, description, clinical_effect, recommendation, status,
            acknowledged_by, acknowledged_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [homeId, resId, medicationIds[inter.medA], medicationIds[inter.medB],
           inter.severity, inter.desc,
           'Monitor closely for adverse effects.',
           inter.severity === 'major' ? 'Discuss with GP urgently' : 'Monitor and document',
           inter.status,
           inter.status === 'acknowledged' ? nurseId : null,
           inter.status === 'acknowledged' ? timeStr(daysAgo(2)) : null,
           timeStr(daysAgo(randInt(1, 15)))]
        );
        track('medication_interactions');
      }
    }

    // =========================================================================
    // MIGRATION 011: RATE UPLIFTS
    // =========================================================================
    console.log('  >  Rate uplifts...');
    const selfFundedRooms = ['1', '4', '6', '7', '9', '11', '13', '15', '17', '19', '21', '23'];
    const upliftRooms = selfFundedRooms.slice(0, 5);
    const upliftStatuses: Array<'pending' | 'approved' | 'applied'> = ['pending', 'approved', 'applied', 'applied', 'approved'];
    for (let i = 0; i < upliftRooms.length; i++) {
      const room = upliftRooms[i];
      const resId = residentIds[room];
      if (!resId) continue;
      const prevRate = randInt(90000, 135000);
      const newRate = prevRate + randInt(2000, 8000);
      await client.query(
        `INSERT INTO rate_uplifts (care_home_id, resident_id, previous_rate_pence, new_rate_pence,
          effective_date, reason, approved_by, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [homeId, resId, prevRate, newRate,
         dateStr(daysFromNow(randInt(7, 60))),
         'Annual fee review - CPI uplift',
         upliftStatuses[i] !== 'pending' ? managerId : null,
         upliftStatuses[i],
         timeStr(daysAgo(randInt(5, 20)))]
      );
      track('rate_uplifts');
    }

    // =========================================================================
    // MIGRATION 011: OCCUPANCY RECORDS
    // =========================================================================
    console.log('  >  Occupancy records...');
    for (let day = 0; day < 30; day++) {
      const occupied = randInt(22, 25);
      await client.query(
        `INSERT INTO occupancy_records (care_home_id, record_date, total_beds, occupied_beds,
          occupancy_pct, revenue_per_bed_pence, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [homeId, dateStr(daysAgo(day)), 30, occupied,
         ((occupied / 30) * 100).toFixed(2),
         randInt(95000, 130000),
         timeStr(daysAgo(day))]
      );
      track('occupancy_records');
    }

    // =========================================================================
    // MIGRATION 011: STAFF COSTS & COST BUDGETS
    // =========================================================================
    console.log('  >  Staff costs & budgets...');
    for (const staffId of allStaffIds) {
      const basicHours = randInt(120, 160);
      const overtimeHours = randInt(0, 20);
      const rate = randInt(1200, 2200);
      await client.query(
        `INSERT INTO staff_costs (care_home_id, staff_id, period_start, period_end,
          basic_hours, overtime_hours, basic_cost_pence, overtime_cost_pence, is_agency, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [homeId, staffId, dateStr(daysAgo(30)), dateStr(daysAgo(0)),
         basicHours, overtimeHours,
         basicHours * rate, overtimeHours * Math.round(rate * 1.5),
         false, timeStr(daysAgo(1))]
      );
      track('staff_costs');
    }

    const budgetCategories = ['staff', 'agency', 'supplies', 'food', 'maintenance'];
    for (const cat of budgetCategories) {
      const budget = randInt(20000_00, 80000_00);
      const actual = budget + randInt(-5000_00, 10000_00);
      await client.query(
        `INSERT INTO cost_budgets (care_home_id, budget_month, budget_pence, actual_pence,
          variance_pence, category, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [homeId, dateStr(daysAgo(15)), budget, actual, actual - budget, cat, timeStr(daysAgo(1))]
      );
      track('cost_budgets');
    }

    // =========================================================================
    // MIGRATION 011: JOB POSTINGS & APPLICATIONS
    // =========================================================================
    console.log('  >  Job postings & applications...');
    const jobPostings = [
      { title: 'Senior Care Assistant', dept: 'Care', contract: 'permanent', hours: 37.5, salary: '24,000 - 26,000', status: 'active' as const },
      { title: 'Night Care Assistant', dept: 'Care', contract: 'permanent', hours: 30, salary: '22,000 - 23,500', status: 'active' as const },
      { title: 'Registered Nurse (RGN)', dept: 'Nursing', contract: 'permanent', hours: 37.5, salary: '33,000 - 38,000', status: 'filled' as const },
    ];
    const jobIds: string[] = [];
    for (const job of jobPostings) {
      const { rows: [j] } = await client.query(
        `INSERT INTO job_postings (care_home_id, title, department, contract_type,
          hours_per_week, salary_range, description, requirements, status,
          posted_at, closes_at, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [homeId, job.title, job.dept, job.contract, job.hours, job.salary,
         `We are looking for a dedicated ${job.title} to join our friendly team.`,
         'Relevant NVQ/QCF qualification, DBS check, right to work in UK.',
         job.status, timeStr(daysAgo(20)),
         job.status === 'filled' ? timeStr(daysAgo(5)) : timeStr(daysFromNow(10)),
         managerId, timeStr(daysAgo(20))]
      );
      jobIds.push(j.id);
      track('job_postings');
    }

    const applicantNames = [
      'Sophie Williams', 'Mohammad Ali', 'Emily Chen', 'David Okafor',
      'Rachel Thompson', 'James Kowalski', 'Fatima Hassan', 'Ben Parker',
      'Aisha Begum', 'Chris Taylor', 'Maria Rodriguez', 'Sam O\'Brien',
    ];
    const stages: Array<'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'> =
      ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
    for (let i = 0; i < 12; i++) {
      const jobId = jobIds[i % jobIds.length];
      await client.query(
        `INSERT INTO job_applications (care_home_id, job_posting_id, applicant_name,
          applicant_email, applicant_phone, stage, notes, applied_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [homeId, jobId, applicantNames[i],
         `${applicantNames[i].toLowerCase().replace(/[' ]/g, '.')}@email.com`,
         `0770${randInt(1000000, 9999999)}`,
         stages[i % stages.length],
         i < 3 ? 'Strong candidate' : null,
         timeStr(daysAgo(randInt(1, 18))),
         timeStr(daysAgo(randInt(1, 18)))]
      );
      track('job_applications');
    }

    // =========================================================================
    // MIGRATION 011: COMPETENCIES & STAFF COMPETENCIES
    // =========================================================================
    console.log('  >  Competencies...');
    const compDefs = [
      { name: 'Medication Administration', cat: 'Clinical', renewal: true, months: 12 },
      { name: 'Manual Handling', cat: 'Health & Safety', renewal: true, months: 12 },
      { name: 'Wound Care Management', cat: 'Clinical', renewal: true, months: 24 },
      { name: 'Dementia Care', cat: 'Specialist', renewal: true, months: 36 },
      { name: 'Infection Control', cat: 'Clinical', renewal: true, months: 12 },
      { name: 'Safeguarding Adults', cat: 'Compliance', renewal: true, months: 24 },
      { name: 'PEG Feed Management', cat: 'Clinical', renewal: true, months: 12 },
      { name: 'Venepuncture', cat: 'Clinical', renewal: true, months: 24 },
      { name: 'Catheter Care', cat: 'Clinical', renewal: true, months: 12 },
      { name: 'End of Life Care', cat: 'Specialist', renewal: false, months: 0 },
    ];
    const compIds: string[] = [];
    for (const comp of compDefs) {
      const { rows: [c] } = await client.query(
        `INSERT INTO competencies (care_home_id, name, category, description,
          requires_renewal, renewal_months, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [homeId, comp.name, comp.cat, `Staff competency: ${comp.name}`,
         comp.renewal, comp.months || null, timeStr(daysAgo(60))]
      );
      compIds.push(c.id);
      track('competencies');
    }

    const compStatuses: Array<'competent' | 'expired' | 'in_training' | 'not_started'> =
      ['competent', 'competent', 'competent', 'in_training', 'expired', 'not_started'];
    for (const staffId of clinicalStaff) {
      for (const compId of compIds.slice(0, 6)) {
        const status = rand(compStatuses);
        await client.query(
          `INSERT INTO staff_competencies (care_home_id, staff_id, competency_id,
            signed_off_by, signed_off_date, expiry_date, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [homeId, staffId, compId,
           status === 'competent' ? managerId : null,
           status === 'competent' ? dateStr(daysAgo(randInt(30, 200))) : null,
           status === 'competent' ? dateStr(daysFromNow(randInt(30, 300))) : null,
           status, timeStr(daysAgo(randInt(10, 60)))]
        );
        track('staff_competencies');
      }
    }

    // =========================================================================
    // MIGRATION 011: ABSENCE RECORDS
    // =========================================================================
    console.log('  >  Absence records...');
    const absenceData = [
      { staff: carer1Id, type: 'sickness', days: 3, reason: 'Flu-like symptoms', start: 20 },
      { staff: carer2Id, type: 'annual_leave', days: 5, reason: 'Pre-booked holiday', start: 15 },
      { staff: seniorId, type: 'sickness', days: 1, reason: 'Migraine', start: 8 },
      { staff: nurseId, type: 'annual_leave', days: 7, reason: 'Summer holiday', start: 25 },
      { staff: carer1Id, type: 'sickness', days: 2, reason: 'Back pain', start: 5 },
      { staff: cleaningId, type: 'compassionate', days: 3, reason: 'Family bereavement', start: 12 },
      { staff: kitchenId, type: 'annual_leave', days: 2, reason: 'Personal appointment', start: 3 },
      { staff: maintenanceId, type: 'sickness', days: 1, reason: 'Dental emergency', start: 18 },
    ];
    for (const ab of absenceData) {
      await client.query(
        `INSERT INTO absence_records (care_home_id, staff_id, absence_type, start_date,
          end_date, total_days, reason, self_certified, fit_note_received,
          return_to_work_completed, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [homeId, ab.staff, ab.type, dateStr(daysAgo(ab.start)),
         dateStr(daysAgo(ab.start - ab.days)),
         ab.days, ab.reason,
         ab.days <= 7, ab.days > 7,
         ab.start > 5, managerId, timeStr(daysAgo(ab.start))]
      );
      track('absence_records');
    }

    // =========================================================================
    // MIGRATION 011: FIRE TESTS, DRILLS, EQUIPMENT CHECKS
    // =========================================================================
    console.log('  >  Fire safety records...');
    for (let week = 0; week < 4; week++) {
      await client.query(
        `INSERT INTO fire_tests (care_home_id, test_type, test_date, time_taken_seconds,
          all_clear, conducted_by, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [homeId, 'weekly_alarm', dateStr(daysAgo(week * 7)),
         randInt(15, 45), true, maintenanceId,
         'Weekly fire alarm test completed satisfactorily.',
         timeStr(daysAgo(week * 7))]
      );
      track('fire_tests');
    }

    await client.query(
      `INSERT INTO fire_drills (care_home_id, drill_date, drill_type, evacuation_time_seconds,
        residents_evacuated, staff_participated, issues_identified, corrective_actions,
        conducted_by, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [homeId, dateStr(daysAgo(14)), 'full_evacuation', 285,
       24, 6, 'Fire door on corridor B slow to close',
       'Maintenance to adjust door closer mechanism',
       managerId, 'Quarterly drill completed successfully.',
       timeStr(daysAgo(14))]
    );
    track('fire_drills');

    const fireEquipment = [
      { type: 'Fire Extinguisher', loc: 'Main Entrance' },
      { type: 'Fire Extinguisher', loc: 'Kitchen' },
      { type: 'Fire Blanket', loc: 'Kitchen' },
      { type: 'Smoke Detector', loc: 'Corridor A' },
      { type: 'Smoke Detector', loc: 'Corridor B' },
      { type: 'Emergency Lighting', loc: 'Stairwell' },
      { type: 'Fire Door', loc: 'Corridor B' },
      { type: 'Fire Extinguisher', loc: 'First Floor Landing' },
      { type: 'Call Point', loc: 'Reception' },
      { type: 'Smoke Detector', loc: 'Lounge' },
    ];
    for (const eq of fireEquipment) {
      const status = eq.loc === 'Corridor B' && eq.type === 'Fire Door' ? 'needs_attention' : 'pass';
      await client.query(
        `INSERT INTO fire_equipment_checks (care_home_id, equipment_type, location,
          check_date, status, next_check_date, checked_by, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [homeId, eq.type, eq.loc,
         dateStr(daysAgo(randInt(0, 7))), status,
         dateStr(daysFromNow(randInt(7, 30))), maintenanceId,
         status === 'needs_attention' ? 'Door closer mechanism needs adjustment' : 'Satisfactory',
         timeStr(daysAgo(randInt(0, 7)))]
      );
      track('fire_equipment_checks');
    }

    // =========================================================================
    // MIGRATION 011: PEEPs
    // =========================================================================
    console.log('  >  PEEPs...');
    const peepRooms = highRiskRooms;
    const peepMobility = ['Hoist required', 'Wheelchair bound', 'Bed bound', 'Walking frame - needs escort'];
    const peepMethods = ['Evac chair', 'Ski sheet and carry', 'Wheelchair push to assembly point', 'Guided walk with 2 staff'];
    for (let i = 0; i < peepRooms.length; i++) {
      const room = peepRooms[i];
      const resId = residentIds[room];
      if (!resId) continue;
      await client.query(
        `INSERT INTO peeps (care_home_id, resident_id, mobility_status, evacuation_method,
          assistance_required, equipment_needed, primary_helper, secondary_helper,
          review_date, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [homeId, resId, peepMobility[i % peepMobility.length],
         peepMethods[i % peepMethods.length],
         'Requires two staff members for safe evacuation.',
         rand(['Evac chair', 'Ski sheet', 'Wheelchair', 'Walking frame']),
         seniorId, carer1Id,
         dateStr(daysFromNow(randInt(30, 90))), 'current',
         timeStr(daysAgo(randInt(10, 30)))]
      );
      track('peeps');
    }

    // =========================================================================
    // MIGRATION 011: VISITOR RECORDS
    // =========================================================================
    console.log('  >  Visitor records...');
    const visitorNames = [
      'Patricia Hollis', 'Robert Pemberton', 'Michael Sinclair', 'Judith Fletcher',
      'Dr. Williams (GP)', 'Physiotherapist Smith', 'BT Engineer', 'Fire Officer Jones',
      'Carol Edwards', 'Stephen Barnes', 'Janice Hartley', 'Helen Walton',
    ];
    const visitorTypes: Array<'family' | 'friend' | 'contractor' | 'professional' | 'other'> =
      ['family', 'family', 'family', 'family', 'professional', 'professional', 'contractor', 'professional',
       'family', 'family', 'family', 'family'];
    for (let i = 0; i < 45; i++) {
      const idx = i % visitorNames.length;
      const day = randInt(0, 29);
      const signIn = new Date(daysAgo(day));
      signIn.setHours(randInt(9, 17), randInt(0, 59));
      const isSignedOut = day > 0 || Math.random() > 0.3;
      const signOut = isSignedOut ? new Date(signIn.getTime() + randInt(30, 180) * 60000) : null;
      const roomIdx = (idx % 24) + 1;
      await client.query(
        `INSERT INTO visitor_records (care_home_id, visitor_name, visitor_type, company,
          visiting_resident_id, purpose, sign_in_time, sign_out_time, badge_number,
          dbs_verified, safeguarding_flag, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [homeId, visitorNames[idx], visitorTypes[idx],
         visitorTypes[idx] === 'contractor' ? 'BT Openreach' : null,
         residentIds[String(roomIdx)] || null,
         rand(['Social visit', 'Medical review', 'Maintenance work', 'Family visit']),
         timeStr(signIn), signOut ? timeStr(signOut) : null,
         `V${String(i + 1).padStart(3, '0')}`,
         visitorTypes[idx] === 'professional' || visitorTypes[idx] === 'contractor',
         false, timeStr(signIn)]
      );
      track('visitor_records');
    }

    // =========================================================================
    // MIGRATION 011: ROOM TURNOVERS & CHECKLIST
    // =========================================================================
    console.log('  >  Room turnovers...');
    const { rows: [turnover1] } = await client.query(
      `INSERT INTO room_turnovers (care_home_id, room_number, vacated_date,
        target_ready_date, actual_ready_date, status, assigned_to, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [homeId, '25', dateStr(daysAgo(20)), dateStr(daysAgo(15)), dateStr(daysAgo(14)),
       'ready', cleaningId, 'Full deep clean and redecoration completed.',
       timeStr(daysAgo(20))]
    );
    track('room_turnovers');

    const { rows: [turnover2] } = await client.query(
      `INSERT INTO room_turnovers (care_home_id, room_number, vacated_date,
        target_ready_date, status, assigned_to, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [homeId, '26', dateStr(daysAgo(3)), dateStr(daysFromNow(4)),
       'in_progress', cleaningId, 'Deep clean in progress, awaiting new carpet.',
       timeStr(daysAgo(3))]
    );
    track('room_turnovers');

    const checklistItems = [
      { task: 'Deep clean all surfaces', cat: 'cleaning' as const },
      { task: 'Steam clean carpet', cat: 'cleaning' as const },
      { task: 'Check and repair window locks', cat: 'maintenance' as const },
      { task: 'Touch up paintwork', cat: 'decoration' as const },
      { task: 'Replace mattress', cat: 'inventory' as const },
      { task: 'Update room inventory list', cat: 'admin' as const },
    ];
    for (const item of checklistItems) {
      await client.query(
        `INSERT INTO turnover_checklist_items (care_home_id, turnover_id, task_name,
          category, completed, completed_by, completed_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [homeId, turnover1.id, item.task, item.cat,
         true, cleaningId, timeStr(daysAgo(15)), timeStr(daysAgo(20))]
      );
      track('turnover_checklist_items');
    }
    for (const item of checklistItems.slice(0, 3)) {
      await client.query(
        `INSERT INTO turnover_checklist_items (care_home_id, turnover_id, task_name,
          category, completed, completed_by, completed_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [homeId, turnover2.id, item.task, item.cat,
         item.cat === 'cleaning', item.cat === 'cleaning' ? cleaningId : null,
         item.cat === 'cleaning' ? timeStr(daysAgo(1)) : null,
         timeStr(daysAgo(3))]
      );
      track('turnover_checklist_items');
    }

    // =========================================================================
    // MIGRATION 011: REPORT TEMPLATES
    // =========================================================================
    console.log('  >  Report templates...');
    const reports = [
      { name: 'Monthly KPI Report', source: 'kpis', format: 'pdf' as const },
      { name: 'Medication Audit', source: 'medications', format: 'pdf' as const },
      { name: 'Staff Hours Summary', source: 'staff_costs', format: 'excel' as const },
      { name: 'Incident Summary', source: 'incidents', format: 'pdf' as const },
      { name: 'Occupancy Report', source: 'occupancy', format: 'csv' as const },
    ];
    for (const r of reports) {
      await client.query(
        `INSERT INTO report_templates (care_home_id, name, description, data_source,
          fields, format, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [homeId, r.name, `Auto-generated ${r.name.toLowerCase()} for management review.`,
         r.source, JSON.stringify(['date', 'value', 'category']),
         r.format, managerId, timeStr(daysAgo(30))]
      );
      track('report_templates');
    }

    // =========================================================================
    // MIGRATION 012: OFFLINE SYNC QUEUE
    // =========================================================================
    console.log('  >  Offline sync queue...');
    const syncEntities = ['care_note', 'wellbeing_log', 'medication_admin', 'incident', 'care_task'];
    for (let i = 0; i < 8; i++) {
      const isPending = i >= 6;
      await client.query(
        `INSERT INTO offline_sync_queue (care_home_id, user_id, entity_type, entity_id,
          action, payload, status, synced_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [homeId, rand(clinicalStaff), rand(syncEntities),
         'a0000000-0000-0000-0000-' + String(i).padStart(12, '0'),
         rand(['create', 'update']),
         JSON.stringify({ note: 'Offline entry created on tablet' }),
         isPending ? 'pending' : 'synced',
         isPending ? null : timeStr(daysAgo(randInt(0, 5))),
         timeStr(daysAgo(randInt(0, 7)))]
      );
      track('offline_sync_queue');
    }

    // =========================================================================
    // MIGRATION 012: RESIDENT TABLET REQUESTS
    // =========================================================================
    console.log('  >  Resident tablet requests...');
    const requestTypes: Array<'help' | 'meal_rating' | 'video_call' | 'entertainment' | 'activity_choice'> =
      ['help', 'meal_rating', 'video_call', 'entertainment', 'activity_choice'];
    for (let i = 0; i < 20; i++) {
      const room = String(randInt(1, 24));
      const resId = residentIds[room];
      if (!resId) continue;
      const created = daysAgo(randInt(0, 29));
      const reqType = rand(requestTypes);
      const status = rand(['pending', 'acknowledged', 'completed'] as const);
      await client.query(
        `INSERT INTO resident_tablet_requests (care_home_id, resident_id, request_type,
          payload, status, acknowledged_at, acknowledged_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [homeId, resId, reqType,
         JSON.stringify({ message: reqType === 'help' ? 'Need assistance please' : 'Request submitted' }),
         status,
         status !== 'pending' ? timeStr(new Date(created.getTime() + randInt(5, 30) * 60000)) : null,
         status !== 'pending' ? rand(clinicalStaff) : null,
         timeStr(created)]
      );
      track('resident_tablet_requests');
    }

    // =========================================================================
    // MIGRATION 012: QR ROOM CODES
    // =========================================================================
    console.log('  >  QR room codes...');
    for (let room = 1; room <= 24; room++) {
      const resId = residentIds[String(room)];
      await client.query(
        `INSERT INTO qr_room_codes (care_home_id, resident_id, room_number, qr_code_data, active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [homeId, resId || null, String(room),
         `https://app.carevista.co.uk/qr/room/${room}?h=${homeId.slice(0, 8)}`,
         true, timeStr(daysAgo(30))]
      );
      track('qr_room_codes');
    }

    // =========================================================================
    // MIGRATION 012: BENCHMARKING KPIs
    // =========================================================================
    console.log('  >  Benchmarking KPIs...');
    const kpiMetrics = [
      'falls_per_1000_bed_days', 'medication_errors_rate', 'staff_turnover',
      'occupancy_rate', 'pressure_ulcer_rate', 'agency_usage_pct',
    ];
    for (let month = 0; month < 3; month++) {
      const periodStart = daysAgo((month + 1) * 30);
      const periodEnd = daysAgo(month * 30);
      for (const metric of kpiMetrics) {
        const value = metric === 'occupancy_rate' ? randInt(75, 90) :
                      metric === 'staff_turnover' ? randInt(10, 25) :
                      parseFloat((Math.random() * 5).toFixed(2));
        await client.query(
          `INSERT INTO benchmarking_kpis (care_home_id, period_start, period_end,
            metric_name, metric_value, national_average, peer_average, percentile_rank, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [homeId, dateStr(periodStart), dateStr(periodEnd),
           metric, value,
           parseFloat((value * (0.8 + Math.random() * 0.4)).toFixed(2)),
           parseFloat((value * (0.9 + Math.random() * 0.2)).toFixed(2)),
           randInt(30, 85),
           timeStr(periodEnd)]
        );
        track('benchmarking_kpis');
      }
    }

    // =========================================================================
    // MIGRATION 012: BOARD PACK REPORTS
    // =========================================================================
    console.log('  >  Board pack reports...');
    await client.query(
      `INSERT INTO board_pack_reports (care_home_id, report_month, title, sections,
        status, generated_by, approved_by, approved_at, generated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [homeId, dateStr(daysAgo(30)), 'Monthly Board Pack - Last Month',
       JSON.stringify({ clinical: 'Stable', financial: 'On budget', hr: '2 vacancies' }),
       'approved', managerId, managerId, timeStr(daysAgo(5)), timeStr(daysAgo(10))]
    );
    track('board_pack_reports');

    await client.query(
      `INSERT INTO board_pack_reports (care_home_id, report_month, title, sections,
        status, generated_by, generated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [homeId, dateStr(new Date()), 'Monthly Board Pack - Current Month',
       JSON.stringify({ clinical: 'Draft', financial: 'Pending', hr: 'In progress' }),
       'draft', managerId, timeStr(daysAgo(1))]
    );
    track('board_pack_reports');

    // =========================================================================
    // MIGRATION 012: STAFF PERFORMANCE METRICS
    // =========================================================================
    console.log('  >  Staff performance metrics...');
    for (const staffId of clinicalStaff) {
      for (let month = 0; month < 2; month++) {
        await client.query(
          `INSERT INTO staff_performance_metrics (care_home_id, staff_id, period_start,
            period_end, task_completion_rate, care_note_quality_score,
            avg_response_time_minutes, training_completion_pct,
            notes_count, tasks_completed, tasks_assigned, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [homeId, staffId, dateStr(daysAgo((month + 1) * 30)), dateStr(daysAgo(month * 30)),
           (85 + Math.random() * 15).toFixed(2),
           (70 + Math.random() * 30).toFixed(2),
           randInt(3, 15),
           (80 + Math.random() * 20).toFixed(2),
           randInt(40, 120), randInt(80, 150), randInt(90, 160),
           timeStr(daysAgo(month * 30))]
        );
        track('staff_performance_metrics');
      }
    }

    // =========================================================================
    // MIGRATION 012: E-LEARNING MODULES, QUIZZES, COMPLETIONS
    // =========================================================================
    console.log('  >  E-learning...');
    const eLearningModules = [
      { title: 'Fire Safety Awareness', cat: 'Health & Safety', mandatory: true, mins: 30 },
      { title: 'Infection Prevention', cat: 'Clinical', mandatory: true, mins: 45 },
      { title: 'Manual Handling Update', cat: 'Health & Safety', mandatory: true, mins: 25 },
      { title: 'Dementia Awareness', cat: 'Specialist', mandatory: true, mins: 60 },
      { title: 'Nutrition & Hydration', cat: 'Clinical', mandatory: false, mins: 20 },
      { title: 'Mental Capacity Act', cat: 'Compliance', mandatory: true, mins: 40 },
      { title: 'Falls Prevention', cat: 'Clinical', mandatory: false, mins: 30 },
      { title: 'Dignity in Care', cat: 'Core Values', mandatory: false, mins: 20 },
    ];
    const moduleIds: string[] = [];
    const quizIds: string[] = [];
    for (const mod of eLearningModules) {
      const { rows: [m] } = await client.query(
        `INSERT INTO elearning_modules (care_home_id, title, description, category,
          content_type, duration_minutes, mandatory, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [homeId, mod.title, `Complete this ${mod.title.toLowerCase()} module.`,
         mod.cat, rand(['video', 'interactive', 'document']),
         mod.mins, mod.mandatory, managerId, timeStr(daysAgo(60))]
      );
      moduleIds.push(m.id);
      track('elearning_modules');

      const { rows: [q] } = await client.query(
        `INSERT INTO elearning_quizzes (module_id, title, questions, pass_mark_pct, created_at)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [m.id, `${mod.title} Quiz`,
         JSON.stringify([
           { q: 'Sample question 1?', options: ['A', 'B', 'C', 'D'], answer: 0 },
           { q: 'Sample question 2?', options: ['A', 'B', 'C', 'D'], answer: 2 },
         ]),
         80, timeStr(daysAgo(60))]
      );
      quizIds.push(q.id);
      track('elearning_quizzes');
    }

    for (const staffId of allStaffIds) {
      const modulesToComplete = moduleIds.slice(0, randInt(4, moduleIds.length));
      for (const modId of modulesToComplete) {
        const score = randInt(60, 100);
        await client.query(
          `INSERT INTO elearning_completions (care_home_id, module_id, staff_id,
            quiz_score, passed, completed_at, certificate_id, expiry_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [homeId, modId, staffId, score, score >= 80,
           timeStr(daysAgo(randInt(1, 50))),
           `CERT-${randInt(10000, 99999)}`,
           dateStr(daysFromNow(randInt(180, 365)))]
        );
        track('elearning_completions');
      }
    }

    // =========================================================================
    // MIGRATION 012: COMPETENCY SIGNOFFS
    // =========================================================================
    console.log('  >  Competency signoffs...');
    for (let i = 0; i < 15; i++) {
      const staffId = rand(clinicalStaff);
      const compId = rand(compIds);
      await client.query(
        `INSERT INTO competency_signoffs (care_home_id, staff_id, competency_id,
          assessor_id, observation_date, outcome, evidence_notes,
          signed_off, signed_off_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [homeId, staffId, compId, managerId,
         dateStr(daysAgo(randInt(5, 40))),
         rand(['competent', 'competent', 'not_yet_competent', 'requires_training']),
         'Observed during medication round. Technique satisfactory.',
         Math.random() > 0.3, Math.random() > 0.3 ? timeStr(daysAgo(randInt(1, 10))) : null,
         timeStr(daysAgo(randInt(5, 40)))]
      );
      track('competency_signoffs');
    }

    // =========================================================================
    // MIGRATION 012: DIABETES MANAGEMENT
    // =========================================================================
    console.log('  >  Diabetes management (glucose, insulin, alerts, HbA1c)...');
    const readingTypes: Array<'before_breakfast' | 'after_breakfast' | 'before_lunch' | 'after_lunch' | 'before_dinner' | 'after_dinner' | 'bedtime'> =
      ['before_breakfast', 'after_breakfast', 'before_lunch', 'after_lunch', 'before_dinner', 'after_dinner', 'bedtime'];
    for (const room of diabeticRooms) {
      const resId = residentIds[room];
      if (!resId) continue;

      // Daily glucose readings for 30 days
      for (let day = 0; day < 30; day++) {
        const numReadings = randInt(2, 4);
        for (let r = 0; r < numReadings; r++) {
          const readingType = readingTypes[r % readingTypes.length];
          const baseValue = readingType.startsWith('before') ? 5.5 : 7.5;
          const value = (baseValue + Math.random() * 4 - 1).toFixed(1);
          const recordedAt = new Date(daysAgo(day));
          recordedAt.setHours(readingType.includes('breakfast') ? 7 : readingType.includes('lunch') ? 12 : 18, randInt(0, 30));
          await client.query(
            `INSERT INTO glucose_readings (care_home_id, resident_id, reading_value,
              reading_type, recorded_by, recorded_at)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [homeId, resId, value, readingType, rand(clinicalStaff), timeStr(recordedAt)]
          );
          track('glucose_readings');
        }
      }

      // Insulin doses
      for (let day = 0; day < 30; day++) {
        const adminTime = new Date(daysAgo(day));
        adminTime.setHours(8, randInt(0, 30));
        await client.query(
          `INSERT INTO insulin_doses (care_home_id, resident_id, insulin_type,
            dose_units, injection_site, administered_by, administered_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [homeId, resId, rand(['NovoRapid', 'Lantus', 'Humalog']),
           randInt(6, 20), rand(['Abdomen', 'Thigh', 'Upper arm']),
           rand(clinicalStaff), timeStr(adminTime)]
        );
        track('insulin_doses');
      }

      // Alerts (1-2 per diabetic resident)
      for (let a = 0; a < randInt(1, 2); a++) {
        const isHypo = Math.random() > 0.5;
        await client.query(
          `INSERT INTO diabetes_alerts (care_home_id, resident_id, alert_type,
            glucose_value, triggered_at, acknowledged_by, acknowledged_at, actions_taken)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [homeId, resId, isHypo ? 'hypo' : 'hyper',
           isHypo ? (2.5 + Math.random() * 1.5).toFixed(1) : (15 + Math.random() * 5).toFixed(1),
           timeStr(daysAgo(randInt(2, 25))),
           nurseId, timeStr(daysAgo(randInt(1, 24))),
           isHypo ? 'Glucogel administered, retested in 15 mins' : 'Fluids encouraged, GP informed']
        );
        track('diabetes_alerts');
      }

      // HbA1c records
      await client.query(
        `INSERT INTO hba1c_records (care_home_id, resident_id, value, test_date, recorded_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [homeId, resId, (48 + Math.random() * 20).toFixed(1),
         dateStr(daysAgo(randInt(30, 80))), nurseId, timeStr(daysAgo(randInt(30, 80)))]
      );
      track('hba1c_records');
    }

    // =========================================================================
    // MIGRATION 012: PALLIATIVE CARE
    // =========================================================================
    console.log('  >  Palliative care (plans, comfort rounds, anticipatory meds)...');
    for (const room of palliativeRooms) {
      const resId = residentIds[room];
      if (!resId) continue;

      await client.query(
        `INSERT INTO palliative_care_plans (care_home_id, resident_id,
          preferred_place_of_death, dnacpr_in_place, advance_decision,
          lasting_power_of_attorney, spiritual_needs, preferred_priorities,
          comfort_measures, status, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [homeId, resId, 'Care home - familiar surroundings',
         true, true, true,
         'Church of England - chaplain visits weekly',
         'Pain-free, family present, favourite music playing',
         'Regular repositioning, mouth care, gentle massage, familiar objects nearby',
         'active', nurseId, timeStr(daysAgo(20))]
      );
      track('palliative_care_plans');

      // Comfort rounds every 2 hours for 30 days
      for (let day = 0; day < 30; day++) {
        for (let hour = 0; hour < 24; hour += 2) {
          const scheduled = new Date(daysAgo(day));
          scheduled.setHours(hour, 0, 0, 0);
          const completed = new Date(scheduled.getTime() + randInt(0, 15) * 60000);
          await client.query(
            `INSERT INTO comfort_rounds (care_home_id, resident_id, scheduled_time,
              completed_time, completed_by, pain_score, comfort_notes,
              repositioned, fluids_offered, mouth_care)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [homeId, resId, timeStr(scheduled), timeStr(completed),
             rand(clinicalStaff), randInt(0, 4),
             rand(['Comfortable, sleeping', 'Restless, soothed with music', 'Awake, chatting', 'Settled after repositioning']),
             Math.random() > 0.3, Math.random() > 0.4, Math.random() > 0.5]
          );
          track('comfort_rounds');
        }
      }

      // Anticipatory medications
      const anticMeds = [
        { name: 'Morphine Sulphate', indication: 'Pain', dose: '2.5-5mg', route: 'Subcutaneous' },
        { name: 'Midazolam', indication: 'Agitation/Seizures', dose: '2.5-5mg', route: 'Subcutaneous' },
        { name: 'Hyoscine Butylbromide', indication: 'Respiratory secretions', dose: '20mg', route: 'Subcutaneous' },
        { name: 'Levomepromazine', indication: 'Nausea/Vomiting', dose: '6.25mg', route: 'Subcutaneous' },
      ];
      for (const med of anticMeds) {
        await client.query(
          `INSERT INTO anticipatory_medications (care_home_id, resident_id, medication_name,
            indication, dose, route, location_stored, prescribed_by, prescribed_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [homeId, resId, med.name, med.indication, med.dose, med.route,
           'Controlled drug cupboard - Room medication trolley',
           'Dr. Patel', dateStr(daysAgo(15))]
        );
        track('anticipatory_medications');
      }
    }

    // =========================================================================
    // MIGRATION 013: MUSIC THERAPY
    // =========================================================================
    console.log('  >  Music therapy...');
    const genreNames = ['Classical', 'Jazz', 'Big Band', 'Folk', 'Hymns', 'Pop 1960s', 'Musical Theatre', 'Country'];
    const genreIds: string[] = [];
    for (const name of genreNames) {
      const { rows: [g] } = await client.query(
        `INSERT INTO music_genres (care_home_id, name, description, created_at)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [homeId, name, `${name} music for therapy sessions.`, timeStr(daysAgo(30))]
      );
      genreIds.push(g.id);
      track('music_genres');
    }

    const musicResidents = ['1', '3', '5', '7', '8', '9', '11', '12', '15', '17', '19', '22'];
    for (const room of musicResidents) {
      const resId = residentIds[room];
      if (!resId) continue;
      await client.query(
        `INSERT INTO music_preferences (care_home_id, resident_id, genre_id,
          preferred_artists, preferred_era, tempo_preference, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [homeId, resId, rand(genreIds),
         rand(['Vera Lynn', 'Frank Sinatra', 'The Beatles', 'Glenn Miller', 'Doris Day']),
         rand(['1940s', '1950s', '1960s', '1970s']),
         rand(['slow', 'moderate', 'upbeat']),
         'Responds positively to familiar tunes from younger years.',
         timeStr(daysAgo(25))]
      );
      track('music_preferences');
    }

    for (let i = 0; i < 25; i++) {
      const room = rand(musicResidents);
      const resId = residentIds[room];
      if (!resId) continue;
      const startedAt = daysAgo(randInt(0, 29));
      startedAt.setHours(randInt(10, 16), randInt(0, 59));
      const endedAt = new Date(startedAt.getTime() + randInt(15, 45) * 60000);
      const { rows: [session] } = await client.query(
        `INSERT INTO music_sessions (care_home_id, resident_id, started_at, ended_at,
          mood_before, mood_after, effectiveness, notes, facilitated_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [homeId, resId, timeStr(startedAt), timeStr(endedAt),
         randInt(3, 6), randInt(5, 9), randInt(3, 5),
         rand(['Very engaged, singing along', 'Relaxed and calm', 'Tapping feet, smiling', 'Dozed peacefully']),
         activitiesId, timeStr(startedAt)]
      );
      track('music_sessions');

      for (let s = 0; s < randInt(3, 6); s++) {
        await client.query(
          `INSERT INTO music_session_songs (session_id, title, artist, genre_id,
            duration_secs, resident_response, play_order, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [session.id,
           rand(['White Cliffs of Dover', 'Fly Me to the Moon', 'Yesterday', 'Moon River', 'Somewhere Over the Rainbow', 'Danny Boy']),
           rand(['Vera Lynn', 'Frank Sinatra', 'The Beatles', 'Andy Williams', 'Judy Garland', 'Various']),
           rand(genreIds), randInt(150, 300),
           rand(['singing', 'tapping', 'smiling', 'relaxed', 'no_response']),
           s + 1, timeStr(startedAt)]
        );
        track('music_session_songs');
      }
    }

    // =========================================================================
    // MIGRATION 013: MENU CHOICE SYSTEM
    // =========================================================================
    console.log('  >  Menu options & choices...');
    const menuItems = [
      { meal: 'breakfast', name: 'Porridge with honey', texture: 'normal' },
      { meal: 'breakfast', name: 'Scrambled eggs on toast', texture: 'normal' },
      { meal: 'breakfast', name: 'Full English breakfast', texture: 'normal' },
      { meal: 'breakfast', name: 'Cereal and fruit', texture: 'normal' },
      { meal: 'lunch', name: 'Roast chicken dinner', texture: 'normal' },
      { meal: 'lunch', name: 'Fish pie with vegetables', texture: 'soft' },
      { meal: 'lunch', name: 'Shepherd\'s pie', texture: 'soft' },
      { meal: 'lunch', name: 'Vegetable soup with roll', texture: 'normal' },
      { meal: 'lunch', name: 'Pureed roast dinner', texture: 'pureed' },
      { meal: 'dinner', name: 'Sandwiches and salad', texture: 'normal' },
      { meal: 'dinner', name: 'Jacket potato with beans', texture: 'soft' },
      { meal: 'dinner', name: 'Soup and crusty bread', texture: 'normal' },
      { meal: 'dinner', name: 'Omelette with chips', texture: 'normal' },
      { meal: 'snack', name: 'Tea and biscuits', texture: 'normal' },
      { meal: 'snack', name: 'Fresh fruit', texture: 'normal' },
      { meal: 'snack', name: 'Yoghurt', texture: 'soft' },
      { meal: 'snack', name: 'Cake', texture: 'normal' },
      { meal: 'lunch', name: 'Cottage pie', texture: 'soft' },
      { meal: 'dinner', name: 'Cheese on toast', texture: 'normal' },
      { meal: 'lunch', name: 'Ham salad', texture: 'normal' },
      { meal: 'dinner', name: 'Pasta bake', texture: 'soft' },
    ];
    const menuOptionIds: string[] = [];
    for (const item of menuItems) {
      const { rows: [opt] } = await client.query(
        `INSERT INTO menu_options (care_home_id, meal_type, name, description,
          texture, allergens, active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [homeId, item.meal, item.name, `Freshly prepared ${item.name.toLowerCase()}.`,
         item.texture, JSON.stringify([]),
         true, timeStr(daysAgo(30))]
      );
      menuOptionIds.push(opt.id);
      track('menu_options');
    }

    // Dietary profiles for residents with restrictions
    const dietaryResidents = ['2', '4', '8', '10', '13', '18', '20', '24'];
    for (const room of dietaryResidents) {
      const resId = residentIds[room];
      if (!resId) continue;
      await client.query(
        `INSERT INTO menu_dietary_profiles (care_home_id, resident_id, allergies,
          intolerances, texture_requirement, preferences, calories_target, fluid_target_ml, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [homeId, resId,
         JSON.stringify(room === '13' ? ['gluten'] : []),
         JSON.stringify([]),
         room === '2' || room === '10' || room === '20' ? 'pureed' : room === '4' ? 'soft' : 'normal',
         'Enjoys traditional British food',
         randInt(1500, 2200), randInt(1200, 1800),
         timeStr(daysAgo(20))]
      );
      track('menu_dietary_profiles');
    }

    // Daily meal choices for 14 days
    for (let day = 0; day < 14; day++) {
      for (let room = 1; room <= 24; room++) {
        const resId = residentIds[String(room)];
        if (!resId) continue;
        const mealType = rand(['breakfast', 'lunch', 'dinner'] as const);
        const matchingOptions = menuOptionIds.filter((_, idx) => menuItems[idx].meal === mealType);
        if (matchingOptions.length === 0) continue;
        await client.query(
          `INSERT INTO menu_choices (care_home_id, resident_id, menu_option_id,
            meal_date, meal_type, portion_size, submitted_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [homeId, resId, rand(matchingOptions),
           dateStr(daysAgo(day)), mealType,
           rand(['small', 'regular', 'large']),
           rand(clinicalStaff), timeStr(daysAgo(day))]
        );
        track('menu_choices');
      }
    }

    // =========================================================================
    // MIGRATION 013: FRIENDSHIP MAPPER
    // =========================================================================
    console.log('  >  Friendship observations & connections...');
    const interactionTypes = ['conversation', 'shared_activity', 'meal_together', 'sitting_together', 'helping'];
    for (let i = 0; i < 25; i++) {
      const roomA = String(randInt(1, 24));
      let roomB = String(randInt(1, 24));
      while (roomB === roomA) roomB = String(randInt(1, 24));
      const resA = residentIds[roomA];
      const resB = residentIds[roomB];
      if (!resA || !resB) continue;
      await client.query(
        `INSERT INTO friendship_observations (care_home_id, resident_id, observed_with,
          interaction_type, context, quality_score, observed_by, observed_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [homeId, resA, resB, rand(interactionTypes),
         rand(['In the lounge', 'During lunch', 'At activities', 'In the garden', 'Corridor chat']),
         randInt(2, 5), rand(clinicalStaff),
         timeStr(daysAgo(randInt(0, 29))), timeStr(daysAgo(randInt(0, 29)))]
      );
      track('friendship_observations');
    }

    const friendPairs = [
      ['1', '5'], ['3', '12'], ['7', '11'], ['9', '15'],
      ['2', '8'], ['6', '17'], ['13', '19'], ['16', '22'],
      ['4', '14'], ['21', '23'],
    ];
    for (const [rA, rB] of friendPairs) {
      const resA = residentIds[rA];
      const resB = residentIds[rB];
      if (!resA || !resB) continue;
      await client.query(
        `INSERT INTO friendship_connections (care_home_id, resident_a, resident_b,
          strength, relationship_type, notes, last_interaction, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [homeId, resA, resB, randInt(3, 9),
         rand(['close_friends', 'acquaintances', 'dining_partners', 'activity_partners']),
         'Often seen together in communal areas.',
         timeStr(daysAgo(randInt(0, 7))), timeStr(daysAgo(randInt(10, 25)))]
      );
      track('friendship_connections');
    }

    // =========================================================================
    // MIGRATION 013: PURPOSE ROLES
    // =========================================================================
    console.log('  >  Purpose roles & engagement...');
    const purposeRoleDefs = [
      { name: 'Garden Helper', cat: 'Outdoor' },
      { name: 'Dining Room Greeter', cat: 'Social' },
      { name: 'Library Organiser', cat: 'Cognitive' },
      { name: 'Pet Feeder', cat: 'Animals' },
      { name: 'Plant Waterer', cat: 'Outdoor' },
      { name: 'Post Sorter', cat: 'Cognitive' },
      { name: 'Table Layer', cat: 'Social' },
      { name: 'Art Gallery Curator', cat: 'Creative' },
    ];
    const roleIds: string[] = [];
    for (const role of purposeRoleDefs) {
      const { rows: [r] } = await client.query(
        `INSERT INTO purpose_roles (care_home_id, name, description, category, active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [homeId, role.name, `Resident role: ${role.name}`, role.cat, true, timeStr(daysAgo(25))]
      );
      roleIds.push(r.id);
      track('purpose_roles');
    }

    // Assign roles to residents
    const assignmentIds: string[] = [];
    const roleAssignRooms = ['1', '3', '5', '7', '9', '11', '13', '15', '17', '19', '21', '23'];
    for (let i = 0; i < roleAssignRooms.length; i++) {
      const room = roleAssignRooms[i];
      const resId = residentIds[room];
      if (!resId) continue;
      const { rows: [a] } = await client.query(
        `INSERT INTO purpose_role_assignments (care_home_id, resident_id, role_id,
          status, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [homeId, resId, roleIds[i % roleIds.length],
         'active', 'Enjoys this role, good engagement observed.',
         timeStr(daysAgo(20))]
      );
      assignmentIds.push(a.id);
      track('purpose_role_assignments');
    }

    // Engagement logs
    for (const assignId of assignmentIds) {
      for (let day = 0; day < 30; day += randInt(2, 5)) {
        const room = roleAssignRooms[assignmentIds.indexOf(assignId)];
        const resId = residentIds[room];
        if (!resId) continue;
        await client.query(
          `INSERT INTO purpose_engagement_logs (care_home_id, assignment_id, resident_id,
            engagement_date, duration_mins, satisfaction, notes, logged_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [homeId, assignId, resId,
           dateStr(daysAgo(day)), randInt(10, 45), randInt(3, 5),
           rand(['Enthusiastic', 'Needed prompting but engaged well', 'Very focused', 'Seemed to enjoy']),
           activitiesId, timeStr(daysAgo(day))]
        );
        track('purpose_engagement_logs');
      }
    }

    // =========================================================================
    // MIGRATION 013: MOOD INTERVENTIONS
    // =========================================================================
    console.log('  >  Mood interventions...');
    const moodIntDefs = [
      { name: 'Gentle music', cat: 'Sensory' },
      { name: 'One-to-one conversation', cat: 'Social' },
      { name: 'Hand massage', cat: 'Touch' },
      { name: 'Walk in garden', cat: 'Physical' },
      { name: 'Hot drink and chat', cat: 'Social' },
      { name: 'Favourite TV show', cat: 'Distraction' },
      { name: 'Reminiscence activity', cat: 'Cognitive' },
      { name: 'Aromatherapy', cat: 'Sensory' },
      { name: 'Pet therapy visit', cat: 'Animals' },
      { name: 'Photo album viewing', cat: 'Reminiscence' },
    ];
    const moodIntIds: string[] = [];
    for (const mi of moodIntDefs) {
      const { rows: [m] } = await client.query(
        `INSERT INTO mood_interventions (care_home_id, name, category, description,
          applicable_moods, active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [homeId, mi.name, mi.cat, `Intervention: ${mi.name}`,
         JSON.stringify(['low', 'anxious', 'agitated', 'withdrawn']),
         true, timeStr(daysAgo(30))]
      );
      moodIntIds.push(m.id);
      track('mood_interventions');
    }

    for (let i = 0; i < 35; i++) {
      const room = String(randInt(1, 24));
      const resId = residentIds[room];
      if (!resId) continue;
      await client.query(
        `INSERT INTO mood_intervention_history (care_home_id, resident_id, intervention_id,
          mood_before, mood_after, effectiveness, notes, administered_by, administered_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [homeId, resId, rand(moodIntIds),
         randInt(2, 5), randInt(5, 9), randInt(3, 5),
         rand(['Good response', 'Moderate improvement', 'Very effective', 'Slight improvement']),
         rand(clinicalStaff), timeStr(daysAgo(randInt(0, 29))), timeStr(daysAgo(randInt(0, 29)))]
      );
      track('mood_intervention_history');
    }

    // =========================================================================
    // MIGRATION 013: PHOTO FRAME PHOTOS
    // =========================================================================
    console.log('  >  Photo frame photos...');
    for (let i = 0; i < 25; i++) {
      const room = String(randInt(1, 24));
      const resId = residentIds[room];
      if (!resId) continue;
      const status = rand(['approved', 'approved', 'approved', 'pending', 'rejected'] as const);
      await client.query(
        `INSERT INTO photo_frame_photos (care_home_id, resident_id, photo_url, caption,
          uploaded_by_name, uploaded_by_email, approval_status, approved_by,
          approved_at, display_order, active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [homeId, resId, `https://storage.carevista.co.uk/photos/room${room}/photo_${i}.jpg`,
         rand(['Family Christmas 2023', 'Wedding day', 'Grandchildren visit', 'Holiday memory', 'Birthday celebration']),
         `Family Member (Room ${room})`, `family.room${room}@example.com`,
         status, status === 'approved' ? managerId : null,
         status === 'approved' ? timeStr(daysAgo(randInt(1, 10))) : null,
         i, status !== 'rejected', timeStr(daysAgo(randInt(1, 20)))]
      );
      track('photo_frame_photos');
    }

    // =========================================================================
    // MIGRATION 013: SLEEP TRACKER
    // =========================================================================
    console.log('  >  Sleep logs & profiles...');
    for (let room = 1; room <= 24; room++) {
      const resId = residentIds[String(room)];
      if (!resId) continue;
      for (let day = 0; day < 30; day++) {
        const bedHour = randInt(20, 23);
        const wakeHour = randInt(5, 8);
        const disturbances = randInt(0, 4);
        const totalSleep = (wakeHour + 24 - bedHour) % 24 - disturbances * 0.3;
        await client.query(
          `INSERT INTO sleep_logs (care_home_id, resident_id, sleep_date, bedtime,
            wake_time, disturbances, disturbance_types, quality_rating,
            total_sleep_hrs, notes, logged_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [homeId, resId, dateStr(daysAgo(day)),
           `${String(bedHour).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`,
           `${String(wakeHour).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`,
           disturbances,
           JSON.stringify(disturbances > 0 ? ['toilet', 'pain', 'noise'].slice(0, disturbances) : []),
           randInt(2, 5), totalSleep.toFixed(2),
           disturbances > 2 ? 'Unsettled night, required comfort' : 'Settled well',
           rand(clinicalStaff), timeStr(daysAgo(day))]
        );
        track('sleep_logs');
      }

      // Sleep profile
      await client.query(
        `INSERT INTO sleep_profiles (care_home_id, resident_id, avg_bedtime,
          avg_wake_time, avg_quality, avg_disturbances, common_disturbances,
          effective_interventions, analysis_period_days, last_calculated, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [homeId, resId, '21:30', '06:45',
         (3 + Math.random() * 1.5).toFixed(2),
         (0.5 + Math.random() * 2).toFixed(2),
         JSON.stringify(['toilet', 'pain']),
         JSON.stringify(['warm_drink', 'repositioning']),
         30, timeStr(daysAgo(0)), timeStr(daysAgo(0))]
      );
      track('sleep_profiles');
    }

    // =========================================================================
    // MIGRATION 013: INTERGENERATIONAL PROGRAMMES
    // =========================================================================
    console.log('  >  Intergenerational programmes...');
    const { rows: [prog1] } = await client.query(
      `INSERT INTO intergenerational_programmes (care_home_id, name, description,
        partner_organisation, age_group, frequency, dbs_required, status, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [homeId, 'Reading Buddies', 'Local primary school children read with residents weekly.',
       'St Mary\'s Primary School', '7-9 years', 'Weekly (term time)',
       true, 'active', activitiesId, timeStr(daysAgo(60))]
    );
    track('intergenerational_programmes');

    const { rows: [prog2] } = await client.query(
      `INSERT INTO intergenerational_programmes (care_home_id, name, description,
        partner_organisation, age_group, frequency, dbs_required, status, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [homeId, 'Art Together', 'Monthly art sessions with local college students.',
       'Salford College of Art', '16-18 years', 'Monthly',
       true, 'active', activitiesId, timeStr(daysAgo(45))]
    );
    track('intergenerational_programmes');

    const visitData = [
      { prog: prog1.id, day: 21, visitors: 6, status: 'completed' as const },
      { prog: prog1.id, day: 14, visitors: 5, status: 'completed' as const },
      { prog: prog1.id, day: 7, visitors: 7, status: 'completed' as const },
      { prog: prog2.id, day: 18, visitors: 4, status: 'completed' as const },
      { prog: prog2.id, day: 4, visitors: 5, status: 'completed' as const },
      { prog: prog1.id, day: -3, visitors: 6, status: 'scheduled' as const },
    ];
    for (const v of visitData) {
      const { rows: [visit] } = await client.query(
        `INSERT INTO intergenerational_visits (care_home_id, programme_id, visit_date,
          start_time, end_time, visitor_count, activity_description,
          safeguarding_check_done, status, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [homeId, v.prog, dateStr(v.day >= 0 ? daysAgo(v.day) : daysFromNow(-v.day)),
         '10:00', '11:30', v.visitors,
         v.prog === prog1.id ? 'Paired reading and storytelling' : 'Collaborative art project',
         v.status === 'completed', v.status, activitiesId, timeStr(daysAgo(Math.max(v.day, 1)))]
      );
      track('intergenerational_visits');

      if (v.status === 'completed') {
        const partRooms = ['1', '3', '5', '7', '9'].slice(0, randInt(3, 5));
        for (const room of partRooms) {
          const resId = residentIds[room];
          if (!resId) continue;
          await client.query(
            `INSERT INTO intergenerational_participants (care_home_id, visit_id, resident_id,
              engagement_score, wellbeing_score, notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [homeId, visit.id, resId, randInt(3, 5), randInt(3, 5),
             rand(['Loved it, asked when next visit is', 'Quiet but attentive', 'Very animated and chatty']),
             timeStr(daysAgo(v.day))]
          );
          track('intergenerational_participants');
        }
      }
    }

    // =========================================================================
    // MIGRATION 013: REHAB GOALS
    // =========================================================================
    console.log('  >  Rehab goals & progress...');
    const rehabResidents = ['1', '3', '5', '6', '9', '11', '15', '17'];
    const goalTitles = [
      'Walk to dining room independently',
      'Stand from chair without assistance',
      'Dress upper body independently',
      'Maintain balance for 30 seconds',
      'Climb 3 steps with rail',
      'Transfer bed to chair safely',
      'Manage personal hygiene independently',
      'Walk 20 metres with walking frame',
    ];
    const goalIds: string[] = [];
    for (let i = 0; i < rehabResidents.length; i++) {
      const room = rehabResidents[i];
      const resId = residentIds[room];
      if (!resId) continue;
      const { rows: [goal] } = await client.query(
        `INSERT INTO rehab_goals (care_home_id, resident_id, title, description,
          category, target_date, status, priority, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [homeId, resId, goalTitles[i], `Rehabilitation goal for Room ${room} resident.`,
         rand(['mobility', 'self_care', 'balance', 'strength']),
         dateStr(daysFromNow(randInt(14, 60))),
         rand(['active', 'active', 'achieved']),
         rand(['high', 'medium', 'low']),
         nurseId, timeStr(daysAgo(25))]
      );
      goalIds.push(goal.id);
      track('rehab_goals');

      // Milestones
      const milestones = ['Week 1 assessment', 'Mid-point review', 'Final assessment'];
      for (let m = 0; m < milestones.length; m++) {
        await client.query(
          `INSERT INTO rehab_milestones (care_home_id, goal_id, title, description,
            target_date, completed, completed_at, display_order, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [homeId, goal.id, milestones[m], `Milestone ${m + 1} for this goal.`,
           dateStr(daysFromNow(m * 14)),
           m === 0, m === 0 ? timeStr(daysAgo(15)) : null,
           m, timeStr(daysAgo(25))]
        );
        track('rehab_milestones');
      }

      // Progress logs
      for (let day = 25; day >= 0; day -= randInt(3, 7)) {
        await client.query(
          `INSERT INTO rehab_progress_logs (care_home_id, goal_id, resident_id,
            progress_notes, score, celebration, family_notified, logged_by, logged_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [homeId, goal.id, resId,
           rand(['Good progress today', 'Slight improvement', 'Excellent effort', 'Needs encouragement']),
           randInt(4, 9), Math.random() > 0.8, Math.random() > 0.7,
           rand(clinicalStaff), timeStr(daysAgo(day)), timeStr(daysAgo(day))]
        );
        track('rehab_progress_logs');
      }
    }

    // =========================================================================
    // MIGRATION 013: CELEBRATIONS
    // =========================================================================
    console.log('  >  Celebrations...');
    const celebData = [
      { room: '1', type: 'birthday' as const, title: 'Margaret\'s 91st Birthday', day: -5 },
      { room: '7', type: 'birthday' as const, title: 'Vera\'s 84th Birthday', day: 10 },
      { room: '12', type: 'admission_anniversary' as const, title: 'George\'s 2nd Anniversary', day: 3 },
      { room: '15', type: 'birthday' as const, title: 'Phyllis\'s 85th Birthday', day: -12 },
      { room: '3', type: 'personal' as const, title: 'Dorothy & Michael\'s Wedding Anniversary', day: 8 },
      { room: null, type: 'religious_festival' as const, title: 'Harvest Festival Celebration', day: -2 },
      { room: '21', type: 'birthday' as const, title: 'Muriel\'s 82nd Birthday', day: 15 },
      { room: '5', type: 'admission_anniversary' as const, title: 'Edith\'s 1st Anniversary', day: -8 },
    ];
    for (const celeb of celebData) {
      const resId = celeb.room ? residentIds[celeb.room] : null;
      const celebDate = celeb.day >= 0 ? daysFromNow(celeb.day) : daysAgo(-celeb.day);
      const status = celeb.day < 0 ? 'completed' : celeb.day < 3 ? 'in_progress' : 'planned';
      const { rows: [c] } = await client.query(
        `INSERT INTO celebrations (care_home_id, resident_id, celebration_type, title,
          description, celebration_date, auto_detected, status, budget, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [homeId, resId, celeb.type, celeb.title,
         `${celeb.title} celebration at Willowbrook House.`,
         dateStr(celebDate), celeb.type === 'birthday',
         status, randInt(20, 80) + 0.00,
         activitiesId, timeStr(daysAgo(Math.max(-celeb.day, 14)))]
      );
      track('celebrations');

      // Tasks for each celebration
      const tasks = ['Order cake', 'Decorate room', 'Invite family', 'Prepare card'];
      for (const task of tasks) {
        const completed = status === 'completed' || (status === 'in_progress' && Math.random() > 0.5);
        await client.query(
          `INSERT INTO celebration_tasks (care_home_id, celebration_id, title,
            assigned_to, due_date, completed, completed_at, completed_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [homeId, c.id, task, activitiesId,
           dateStr(new Date(celebDate.getTime() - 2 * 86400000)),
           completed, completed ? timeStr(daysAgo(Math.max(-celeb.day + 1, 1))) : null,
           completed ? activitiesId : null,
           timeStr(daysAgo(Math.max(-celeb.day, 14)))]
        );
        track('celebration_tasks');
      }
    }

    // =========================================================================
    // MIGRATION 014: ADMISSION REFERRALS & MATCHES
    // =========================================================================
    console.log('  >  Admission referrals & matches...');
    const referralData = [
      { name: 'Joan Whitaker', status: 'accepted', urgency: 'routine', src: 'Social Services' },
      { name: 'Peter Andrews', status: 'pending', urgency: 'urgent', src: 'Hospital discharge' },
      { name: 'Mary Collins', status: 'waitlisted', urgency: 'routine', src: 'Self-referral' },
      { name: 'Thomas Wright', status: 'rejected', urgency: 'routine', src: 'GP referral' },
    ];
    for (const ref of referralData) {
      const { rows: [r] } = await client.query(
        `INSERT INTO admission_referrals (care_home_id, name, date_of_birth, referral_source,
          care_needs, mobility, urgency, status, decision_notes,
          decided_by, decided_at, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [homeId, ref.name, '1935-03-15', ref.src,
         JSON.stringify({ nursing: ref.urgency === 'urgent', dementia: false, mobility: 'limited' }),
         rand(['wheelchair', 'walking_frame', 'independent']),
         ref.urgency, ref.status,
         ref.status !== 'pending' ? `Assessment completed: ${ref.status}` : null,
         ref.status !== 'pending' ? managerId : null,
         ref.status !== 'pending' ? timeStr(daysAgo(randInt(1, 5))) : null,
         managerId, timeStr(daysAgo(randInt(5, 20)))]
      );
      track('admission_referrals');

      await client.query(
        `INSERT INTO admission_matches (care_home_id, referral_id, overall_score,
          recommendation, reasoning, care_needs, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [homeId, r.id, randInt(60, 95),
         ref.status === 'accepted' ? 'accept' : ref.status === 'rejected' ? 'decline' : 'review',
         JSON.stringify({ capacity: true, skills_match: randInt(70, 95), room_available: ref.status !== 'rejected' }),
         JSON.stringify({ nursing: ref.urgency === 'urgent', dementia: false }),
         managerId, timeStr(daysAgo(randInt(5, 15)))]
      );
      track('admission_matches');
    }

    // =========================================================================
    // MIGRATION 014: AI CARE PLANS
    // =========================================================================
    console.log('  >  AI care plans...');
    const aiPlanRooms = ['2', '4', '8', '14', '20'];
    for (const room of aiPlanRooms) {
      const resId = residentIds[room];
      if (!resId) continue;
      await client.query(
        `INSERT INTO ai_care_plans (care_home_id, resident_id, content, status,
          version, review_notes, reviewed_by, reviewed_at, generated_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [homeId, resId,
         JSON.stringify({
           summary: `AI-generated care plan for Room ${room} resident.`,
           goals: ['Maintain comfort', 'Reduce fall risk', 'Improve nutrition'],
           interventions: ['2-hourly repositioning', 'Falls sensor', 'Fortified meals'],
           review_date: dateStr(daysFromNow(14)),
         }),
         rand(['draft', 'draft', 'approved']),
         1, 'Generated by CareVista AI. Requires clinical review.',
         room === '2' ? nurseId : null,
         room === '2' ? timeStr(daysAgo(3)) : null,
         managerId, timeStr(daysAgo(randInt(3, 15)))]
      );
      track('ai_care_plans');
    }

    // =========================================================================
    // MIGRATION 014: CONSENT RECORDS & CAPACITY ASSESSMENTS
    // =========================================================================
    console.log('  >  Consent records & capacity assessments...');
    const consentCategories = ['medication', 'photography', 'data_sharing', 'research', 'activities'];
    for (let room = 1; room <= 24; room++) {
      const resId = residentIds[String(room)];
      if (!resId) continue;
      for (const cat of consentCategories.slice(0, randInt(2, 5))) {
        const { rows: [consent] } = await client.query(
          `INSERT INTO consent_records (care_home_id, resident_id, category, description,
            consent_given_by, relationship, review_date, capacity_assessed,
            status, recorded_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [homeId, resId, cat, `Consent for ${cat.replace('_', ' ')}.`,
           dementiaRooms.includes(String(room)) ? `NOK (Room ${room})` : 'Self',
           dementiaRooms.includes(String(room)) ? 'Next of kin' : 'Self',
           dateStr(daysFromNow(randInt(60, 365))),
           dementiaRooms.includes(String(room)),
           'active', nurseId, timeStr(daysAgo(randInt(10, 60)))]
        );
        track('consent_records');

        if (dementiaRooms.includes(String(room)) && cat === 'medication') {
          await client.query(
            `INSERT INTO capacity_assessments (care_home_id, consent_id, has_capacity,
              assessment_details, assessed_by, recorded_by, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [homeId, consent.id, false,
             'Resident unable to retain information about medication due to advanced dementia. Best interests decision made with NOK.',
             nurseId, nurseId, timeStr(daysAgo(randInt(10, 30)))]
          );
          track('capacity_assessments');
        }
      }
    }

    // =========================================================================
    // MIGRATION 014: REGULATORY NOTIFICATIONS
    // =========================================================================
    console.log('  >  Regulatory notifications...');
    const regNotifs = [
      { type: 'death', status: 'submitted', resident: '24' },
      { type: 'injury', status: 'draft', resident: '10' },
      { type: 'safeguarding', status: 'pending', resident: '8' },
      { type: 'absence', status: 'submitted', resident: null },
    ];
    for (const rn of regNotifs) {
      await client.query(
        `INSERT INTO regulatory_notifications (care_home_id, type, resident_id,
          form_data, status, deadline, submission_ref, submitted_at,
          submitted_by, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [homeId, rn.type, rn.resident ? residentIds[rn.resident] : null,
         JSON.stringify({ details: `${rn.type} notification - demo data`, date: dateStr(daysAgo(5)) }),
         rn.status, timeStr(daysFromNow(rn.status === 'draft' ? 10 : 5)),
         rn.status === 'submitted' ? `CQC-${rn.type.toUpperCase()}-${randInt(1000, 9999)}` : null,
         rn.status === 'submitted' ? timeStr(daysAgo(3)) : null,
         rn.status === 'submitted' ? managerId : null,
         managerId, timeStr(daysAgo(randInt(3, 10)))]
      );
      track('regulatory_notifications');
    }

    // =========================================================================
    // MIGRATION 014: SMART HANDOVERS & ACTIONS
    // =========================================================================
    console.log('  >  Smart handovers...');
    const shiftTypes = ['morning', 'evening'];
    for (let day = 0; day < 30; day++) {
      for (const shiftType of shiftTypes) {
        const { rows: [handover] } = await client.query(
          `INSERT INTO smart_handovers (care_home_id, shift_type, critical_items,
            full_summary, generated_by, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [homeId, shiftType,
           JSON.stringify([
             { resident: 'Room 4', item: 'Pain management review needed' },
             { resident: 'Room 20', item: 'Family visiting this afternoon' },
             { resident: 'Room 8', item: 'New medication started - monitor' },
           ]),
           JSON.stringify({
             incidents: randInt(0, 2),
             medication_changes: randInt(0, 3),
             appointments: randInt(0, 4),
             concerns: ['Monitor fluid intake Room 10', 'Falls risk Room 14'],
           }),
           rand(clinicalStaff), 'active', timeStr(daysAgo(day))]
        );
        track('smart_handovers');

        // Actions for each handover
        for (let a = 0; a < randInt(2, 4); a++) {
          await client.query(
            `INSERT INTO handover_actions (care_home_id, handover_id, item_index,
              action_taken, outcome, recorded_by, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [homeId, handover.id, a,
             rand(['GP called', 'Family updated', 'Medication administered', 'Observation completed']),
             rand(['Resolved', 'Ongoing', 'Referred', 'Completed']),
             rand(clinicalStaff), timeStr(daysAgo(day))]
          );
          track('handover_actions');
        }
      }
    }

    // =========================================================================
    // MIGRATION 014: ENVIRONMENTAL READINGS
    // =========================================================================
    console.log('  >  Environmental readings...');
    const zones = ['Main Lounge', 'Dining Room', 'Corridor A', 'Garden Room', 'Bedroom Wing'];
    for (let day = 0; day < 30; day++) {
      // Every hour for recent 7 days, every 4 hours for older data to keep volume reasonable
      const hourStep = day < 7 ? 1 : 4;
      for (let hour = 0; hour < 24; hour += hourStep) {
        for (const zone of zones) {
          const recordedAt = new Date(daysAgo(day));
          recordedAt.setHours(hour, 0, 0, 0);
          await client.query(
            `INSERT INTO environmental_readings (care_home_id, zone, noise_level,
              light_level, temperature, humidity, air_quality, recorded_at, recorded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [homeId, zone,
             (30 + Math.random() * 30).toFixed(1),
             (100 + Math.random() * 400).toFixed(1),
             (19 + Math.random() * 4).toFixed(1),
             (35 + Math.random() * 25).toFixed(1),
             (80 + Math.random() * 20).toFixed(1),
             timeStr(recordedAt), null]
          );
          track('environmental_readings');
        }
      }
    }

    // =========================================================================
    // MIGRATION 014: CD REGISTER
    // =========================================================================
    console.log('  >  CD register...');
    const cdRooms = ['2', '4', '7', '20', '24'];
    const cdMeds = [
      { name: 'Morphine Sulphate 10mg', dose: '10mg' },
      { name: 'Oramorph 10mg/5ml', dose: '5mg' },
      { name: 'Lorazepam 1mg', dose: '0.5mg' },
      { name: 'Zopiclone 3.75mg', dose: '3.75mg' },
    ];
    for (const room of cdRooms) {
      const resId = residentIds[room];
      if (!resId) continue;
      let balance = randInt(20, 50);
      for (let day = 29; day >= 0; day--) {
        if (Math.random() > 0.6) continue; // not every day
        const med = rand(cdMeds);
        balance -= 1;
        const adminTime = new Date(daysAgo(day));
        adminTime.setHours(randInt(6, 22), randInt(0, 59));
        await client.query(
          `INSERT INTO cd_register (care_home_id, resident_id, medication_name, dose,
            quantity, administered_by, witnessed_by, balance, notes, administration_time, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [homeId, resId, med.name, med.dose,
           1, nurseId, rand([seniorId, deputyId]),
           balance, 'Stock checked and correct.',
           timeStr(adminTime), timeStr(adminTime)]
        );
        track('cd_register');
      }
    }

    // =========================================================================
    // MIGRATION 014: RESIDENT BELONGINGS
    // =========================================================================
    console.log('  >  Resident belongings...');
    const belongingItems = [
      'Gold wedding ring', 'Wristwatch (silver)', 'Reading glasses', 'Hearing aid (left)',
      'Walking stick (wooden)', 'Family photo album', 'Portable radio', 'Knitting bag',
      'Personal blanket (blue)', 'Dentures (upper)', 'Electric razor', 'Necklace (pearl)',
      'Cardigan (green)', 'Slippers (tartan)', 'Bible',
    ];
    for (let room = 1; room <= 24; room += 2) {
      const resId = residentIds[String(room)];
      if (!resId) continue;
      const numItems = randInt(3, 5);
      for (let i = 0; i < numItems; i++) {
        await client.query(
          `INSERT INTO resident_belongings (care_home_id, resident_id, description,
            category, recorded_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [homeId, resId, belongingItems[(room + i) % belongingItems.length],
           rand(['valuables', 'clothing', 'personal', 'medical', 'general']),
           rand(clinicalStaff), timeStr(daysAgo(randInt(5, 30)))]
        );
        track('resident_belongings');
      }
    }

    // =========================================================================
    // MIGRATION 014: RESIDENT WEIGHTS
    // =========================================================================
    console.log('  >  Resident weights...');
    for (let room = 1; room <= 24; room++) {
      const resId = residentIds[String(room)];
      if (!resId) continue;
      const baseWeight = 50 + Math.random() * 40; // 50-90kg range
      const height = 1.5 + Math.random() * 0.3; // 1.5-1.8m
      for (let month = 0; month < 3; month++) {
        const weight = (baseWeight + (Math.random() - 0.5) * 3).toFixed(1);
        const bmi = (parseFloat(weight) / (height * height)).toFixed(1);
        const mustScore = parseFloat(bmi) < 18.5 ? 2 : parseFloat(bmi) < 20 ? 1 : 0;
        await client.query(
          `INSERT INTO resident_weights (care_home_id, resident_id, weight_kg, bmi,
            must_score, recorded_by, notes, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [homeId, resId, weight, bmi, mustScore,
           rand(clinicalStaff),
           mustScore > 0 ? 'Weight loss noted - dietary review requested' : 'Weight stable',
           timeStr(daysAgo(month * 30))]
        );
        track('resident_weights');
      }
    }

    // =========================================================================
    // CQC COMPLIANCE DATA
    // =========================================================================
    console.log('  >  CQC Domain Scores...');
    const cqcDomains = ['safe', 'effective', 'caring', 'responsive', 'well_led'];
    const domainBaseScores: Record<string, number> = { safe: 72, effective: 68, caring: 82, responsive: 75, well_led: 64 };
    const domainStrengths: Record<string, string[]> = {
      safe: ['Low incident rate', 'Strong medication management', 'Comprehensive risk assessments', 'Good infection control compliance'],
      effective: ['High training completion rate', 'Regular care plan reviews', 'Good nutrition monitoring', 'Active MDT working'],
      caring: ['Excellent resident feedback', 'Strong family engagement', 'Person-centred approach', 'Dignity well maintained'],
      responsive: ['Varied activity programme', 'Quick complaint resolution', 'Flexible daily routines', 'Good communication support'],
      well_led: ['Regular audits completed', 'Staff meetings documented', 'Clear governance structure', 'Active improvement plans'],
    };
    const domainWeaknesses: Record<string, string[]> = {
      safe: ['2 overdue risk assessments', 'Fire drill attendance gaps', 'Agency staff induction records incomplete'],
      effective: ['3 staff with expired training', 'Some care plans overdue review', 'Supervision records gaps'],
      caring: ['Limited life story documentation', 'End of life plans need updating', 'Spiritual needs assessments incomplete'],
      responsive: ['Weekend activity provision limited', 'Discharge planning documentation gaps', 'Environment personalisation inconsistent'],
      well_led: ['Policy reviews overdue', 'Staff survey participation low', 'Partnership working evidence limited', 'Duty of candour records incomplete'],
    };
    const domainRecommendations: Record<string, string[]> = {
      safe: ['Complete overdue risk assessments within 7 days', 'Schedule fire drill make-up session', 'Review agency induction process'],
      effective: ['Prioritise expired training renewals', 'Implement care plan review tracker', 'Schedule outstanding supervisions'],
      caring: ['Allocate time for life story work', 'Review all end of life care plans', 'Conduct spiritual needs assessments'],
      responsive: ['Develop weekend activity schedule', 'Update discharge planning templates', 'Support residents with room personalisation'],
      well_led: ['Complete overdue policy reviews', 'Launch anonymous staff survey', 'Document partner meetings and outcomes'],
    };

    for (const domain of cqcDomains) {
      const baseScore = domainBaseScores[domain];
      // Insert scores for last 30 days (one per week for realism)
      for (let week = 0; week < 5; week++) {
        const score = Math.min(100, Math.max(30, baseScore + randInt(-5, 8) - week * 2));
        const evidenceCount = randInt(8, 20);
        const gapsCount = score < 70 ? randInt(3, 7) : randInt(0, 3);
        await client.query(
          `INSERT INTO cqc_domain_scores (care_home_id, domain, score, evidence_count, gaps_count, strengths, weaknesses, recommendations, calculated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [homeId, domain, score, evidenceCount, gapsCount,
           JSON.stringify(domainStrengths[domain]),
           JSON.stringify(domainWeaknesses[domain]),
           JSON.stringify(domainRecommendations[domain]),
           timeStr(daysAgo(week * 7))]
        );
        track('cqc_domain_scores');
      }
    }

    console.log('  >  CQC Evidence Packs...');
    const evidencePackConfigs = [
      { domains: ['safe', 'effective'], daysBack: 5, status: 'complete' },
      { domains: ['caring', 'responsive', 'well_led'], daysBack: 12, status: 'complete' },
      { domains: ['safe', 'caring', 'well_led'], daysBack: 20, status: 'complete' },
      { domains: ['safe', 'effective', 'caring', 'responsive', 'well_led'], daysBack: 28, status: 'complete' },
    ];
    for (const cfg of evidencePackConfigs) {
      const createdAt = daysAgo(cfg.daysBack);
      const rangeStart = daysAgo(cfg.daysBack + 30);
      const rangeEnd = daysAgo(cfg.daysBack);
      const content: Record<string, any> = {};
      for (const d of cfg.domains) {
        content[d] = {
          incidents_count: randInt(1, 8),
          training_compliance: `${randInt(85, 98)}%`,
          care_notes_count: randInt(50, 200),
          audits_completed: randInt(2, 6),
        };
      }
      await client.query(
        `INSERT INTO cqc_evidence_packs (care_home_id, generated_by, domains_included, date_range_start, date_range_end, content, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [homeId, managerId, cfg.domains, dateStr(rangeStart), dateStr(rangeEnd), JSON.stringify(content), cfg.status, timeStr(createdAt)]
      );
      track('cqc_evidence_packs');
    }

    console.log('  >  Policy Reviews...');
    const { rows: policyRows } = await client.query(
      `SELECT id FROM policies WHERE care_home_id = $1 LIMIT 12`, [homeId]
    );
    const reviewers = [managerId, deputyId, nurseId, seniorId];
    for (let i = 0; i < policyRows.length; i++) {
      const policyId = policyRows[i].id;
      const reviewDate = daysAgo(randInt(10, 90));
      // Make some policies overdue (next_review_date in the past)
      const isOverdue = i < 4;
      const nextReview = isOverdue ? daysAgo(randInt(1, 20)) : daysFromNow(randInt(30, 180));
      await client.query(
        `INSERT INTO policy_reviews (care_home_id, policy_id, reviewer_id, review_date, next_review_date, status, changes_made, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [homeId, policyId, rand(reviewers), dateStr(reviewDate), dateStr(nextReview),
         isOverdue ? 'overdue' : 'reviewed',
         i % 3 === 0 ? 'Updated section 3.2 with new guidance' : i % 3 === 1 ? 'Minor formatting changes' : 'No changes required',
         i % 2 === 0 ? 'Reviewed with team during staff meeting' : 'Annual review completed',
         timeStr(reviewDate)]
      );
      track('policy_reviews');
    }

    console.log('  >  Inspection Prep Checklists...');
    const checklistItemsByDomain: Record<string, { title: string; description: string; completed: boolean }[]> = {
      safe: [
        { title: 'Risk assessments up to date', description: 'Verify all resident risk assessments have been reviewed within the last month', completed: true },
        { title: 'Incident reporting procedures', description: 'Confirm incident reporting system is accessible and staff are trained', completed: true },
        { title: 'Medication management audit', description: 'Check medication storage, administration records, and controlled drugs register', completed: true },
        { title: 'Safeguarding policies current', description: 'Ensure safeguarding policies are reviewed and staff have completed training', completed: false },
        { title: 'Fire safety checks', description: 'Verify fire drills conducted, equipment tested, and evacuation plans displayed', completed: true },
        { title: 'Infection control measures', description: 'Check hand hygiene compliance, PPE availability, and cleaning schedules', completed: true },
        { title: 'Staffing levels adequate', description: 'Confirm staffing ratios meet requirements for current resident needs', completed: false },
        { title: 'Equipment maintenance records', description: 'Verify all equipment has current safety certificates and maintenance logs', completed: true },
      ],
      effective: [
        { title: 'Staff training compliance >90%', description: 'Verify all mandatory training is up to date for all staff members', completed: true },
        { title: 'Care plan reviews current', description: 'Confirm care plans have been reviewed within required timeframes', completed: false },
        { title: 'Nutrition and hydration monitoring', description: 'Check MUST assessments, food and fluid charts, and weight monitoring', completed: true },
        { title: 'Health outcome tracking', description: 'Review clinical outcome data and improvement metrics', completed: true },
        { title: 'Multi-disciplinary working', description: 'Evidence of GP visits, specialist referrals, and MDT meetings', completed: false },
        { title: 'Consent documentation', description: 'Verify mental capacity assessments and consent forms are in place', completed: true },
        { title: 'Evidence-based practice', description: 'Confirm care approaches align with current best practice guidance', completed: false },
        { title: 'Supervision records', description: 'Check staff supervision and appraisal records are current', completed: true },
      ],
      caring: [
        { title: 'Dignity and respect observations', description: 'Evidence of privacy, choice, and dignified care delivery', completed: true },
        { title: 'Family engagement records', description: 'Verify regular communication with families and involvement in care', completed: true },
        { title: 'Life story work', description: 'Confirm person-centred life stories are in place and used in care planning', completed: false },
        { title: 'Resident feedback collected', description: 'Check resident surveys, meetings, and feedback mechanisms', completed: true },
        { title: 'End of life care planning', description: 'Verify advance care plans and preferred priorities for care', completed: true },
        { title: 'Emotional support evidence', description: 'Records of emotional support, wellbeing activities, and mental health care', completed: true },
        { title: 'Cultural and spiritual needs', description: 'Evidence that cultural, religious, and spiritual needs are met', completed: false },
        { title: 'Independence promotion', description: 'Examples of supporting residents to maintain independence', completed: true },
      ],
      responsive: [
        { title: 'Activity programme variety', description: 'Verify diverse activity programme meeting different interests and abilities', completed: true },
        { title: 'Complaints handling', description: 'Review complaints log, response times, and resolution outcomes', completed: true },
        { title: 'Person-centred care plans', description: 'Confirm care plans reflect individual preferences and needs', completed: true },
        { title: 'Admission process', description: 'Check pre-admission assessments and transition support', completed: false },
        { title: 'Daily routine flexibility', description: 'Evidence that residents can choose their own routines', completed: true },
        { title: 'Communication needs met', description: 'Verify aids and approaches for residents with communication needs', completed: false },
        { title: 'Discharge planning', description: 'Check processes for planned and unplanned discharges', completed: false },
        { title: 'Environment personalisation', description: 'Evidence of personalised rooms and communal spaces', completed: true },
      ],
      well_led: [
        { title: 'Governance framework', description: 'Review management structure, accountability, and decision-making processes', completed: true },
        { title: 'Quality assurance audits', description: 'Verify regular internal audits are conducted and actioned', completed: true },
        { title: 'Policy review schedule', description: 'Confirm all policies are reviewed within their review dates', completed: false },
        { title: 'Staff engagement', description: 'Evidence of staff meetings, feedback mechanisms, and morale initiatives', completed: false },
        { title: 'Regulatory compliance', description: 'Check CQC notifications submitted and conditions met', completed: true },
        { title: 'Continuous improvement plan', description: 'Review improvement plans and evidence of progress', completed: true },
        { title: 'Partnership working', description: 'Evidence of working with external partners and stakeholders', completed: false },
        { title: 'Transparency and openness', description: 'Check duty of candour compliance and open culture evidence', completed: true },
      ],
    };

    for (const domain of cqcDomains) {
      const items = checklistItemsByDomain[domain];
      const completedCount = items.filter(i => i.completed).length;
      await client.query(
        `INSERT INTO inspection_prep_checklists (care_home_id, title, domain, items, completed_items, total_items, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [homeId,
         `CQC ${domain.replace('_', ' ').toUpperCase()} Domain - Inspection Preparation`,
         domain,
         JSON.stringify(items),
         completedCount,
         items.length,
         completedCount === items.length ? 'complete' : 'in_progress',
         managerId,
         timeStr(daysAgo(7))]
      );
      track('inspection_prep_checklists');
    }

    // =========================================================================
    // PREDICTIVE RISK DATA
    // =========================================================================
    console.log('  >  Predictive Risk Scores...');
    for (const room of highRiskRooms) {
      const resId = residentIds[room];
      if (!resId) continue;

      // Generate falls and deterioration scores over last 30 days (every 3-5 days)
      for (let dBack = 0; dBack < 30; dBack += randInt(3, 5)) {
        const fallsScore = randInt(45, 92);
        const fallsFactors: Record<string, any> = {
          age_risk: randInt(5, 15),
          mobility_score: randInt(10, 30),
          medication_risk: randInt(5, 20),
          cognitive_impairment: randInt(5, 25),
          previous_falls: randInt(0, 15),
          environmental_risk: randInt(3, 10),
        };
        await client.query(
          `INSERT INTO predictive_risk_scores (care_home_id, resident_id, risk_type, score, factors, generated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [homeId, resId, 'falls', fallsScore, JSON.stringify(fallsFactors), timeStr(daysAgo(dBack))]
        );
        track('predictive_risk_scores');

        const deterScore = randInt(40, 85);
        const deterFactors: Record<string, any> = {
          vital_signs_trend: randInt(5, 20),
          weight_change: randInt(3, 15),
          nutrition_risk: randInt(5, 18),
          infection_indicators: randInt(2, 12),
          functional_decline: randInt(5, 20),
          comorbidity_burden: randInt(8, 25),
        };
        await client.query(
          `INSERT INTO predictive_risk_scores (care_home_id, resident_id, risk_type, score, factors, generated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [homeId, resId, 'deterioration', deterScore, JSON.stringify(deterFactors), timeStr(daysAgo(dBack))]
        );
        track('predictive_risk_scores');
      }
    }

    console.log('  >  Predictive Alerts...');
    const alertConfigs = [
      { room: '2', alertType: 'falls_risk', riskScore: 88, factors: { mobility_decline: true, recent_near_miss: true, medication_change: true } },
      { room: '4', alertType: 'falls_risk', riskScore: 82, factors: { cognitive_impairment: true, unsteady_gait: true, history_of_falls: true } },
      { room: '8', alertType: 'deterioration_risk', riskScore: 79, factors: { weight_loss: true, reduced_appetite: true, increased_confusion: true } },
      { room: '10', alertType: 'falls_risk', riskScore: 91, factors: { post_hospital: true, new_medication: true, mobility_aid_required: true } },
      { room: '14', alertType: 'weight_loss_risk', riskScore: 74, factors: { bmi_declining: true, poor_intake: true, recent_illness: true } },
      { room: '20', alertType: 'deterioration_risk', riskScore: 85, factors: { palliative_care: true, pain_increase: true, functional_decline: true } },
      { room: '24', alertType: 'medication_interaction', riskScore: 72, factors: { polypharmacy: true, new_prescription: true, renal_function_change: true } },
      { room: '4', alertType: 'deterioration_risk', riskScore: 76, factors: { infection_signs: true, temp_elevated: true, reduced_mobility: true } },
    ];

    for (const cfg of alertConfigs) {
      const resId = residentIds[cfg.room];
      if (!resId) continue;
      await client.query(
        `INSERT INTO predictive_alerts (care_home_id, resident_id, alert_type, risk_score, threshold, factors, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [homeId, resId, cfg.alertType, cfg.riskScore, 70, JSON.stringify(cfg.factors), 'active', timeStr(daysAgo(randInt(0, 3)))]
      );
      track('predictive_alerts');
    }

    // =========================================================================
    // COMMIT & SUMMARY
    // =========================================================================
    await client.query('COMMIT');
    console.log('\n  DEMO SEED COMPLETE!\n');
    console.log('  Summary of seeded data:');
    console.log('  ' + '-'.repeat(50));
    const sortedTables = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [table, count] of sortedTables) {
      console.log(`    ${table.padEnd(35)} ${String(count).padStart(6)}`);
    }
    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    console.log('  ' + '-'.repeat(50));
    console.log(`    ${'TOTAL'.padEnd(35)} ${String(total).padStart(6)}`);
    console.log('\n  All demo data seeded successfully.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR during demo seed - rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemo();
