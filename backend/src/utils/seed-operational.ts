// ============================================================
// src/utils/seed-operational.ts
// Populates operational demo data (housekeeping, menu, room turnovers)
// for the existing seeded residents. Idempotent — safe to re-run.
// Usage: npm run seed:ops
// ============================================================
import 'dotenv/config';
import { Pool } from 'pg';

const useSSL = process.env.NODE_ENV === 'production' || /sslmode=require/.test(process.env.DATABASE_URL || '') || process.env.PGSSL === 'true';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: useSSL ? { rejectUnauthorized: false } : false });

const DAILY_ROOM = [
  'Remove waste - Empty all bins', 'Vacuum clean floors / swept',
  'Remove any obvious dirt/spillages from floors & surface',
  'General clean to sanitary fittings, soap dishes', 'Sweep & wash floor in suite / room',
  'Replenish consumables - toilet rolls, paper towels', 'All door handles and railing around the house',
];
const MENU = [
  { meal: 'breakfast', name: 'Porridge with honey', texture: 'normal' },
  { meal: 'breakfast', name: 'Full English breakfast', texture: 'normal' },
  { meal: 'lunch', name: 'Roast chicken with vegetables', texture: 'normal' },
  { meal: 'lunch', name: 'Cottage pie (soft)', texture: 'soft' },
  { meal: 'dinner', name: 'Fish pie with peas', texture: 'normal' },
  { meal: 'dinner', name: 'Pureed vegetable soup', texture: 'pureed' },
];

async function main() {
  const c = await pool.connect();
  try {
    const { rows: [home] } = await c.query(`SELECT id FROM care_homes ORDER BY created_at LIMIT 1`);
    if (!home) { console.log('No care home found — run the main seed first.'); return; }
    const chId = home.id;
    const uid = async (email: string) => (await c.query(`SELECT id FROM users WHERE email=$1`, [email])).rows[0]?.id || null;
    const cleaning = await uid('cleaning@demo.carevista.co.uk');
    const kitchen = await uid('kitchen@demo.carevista.co.uk');
    const maint = await uid('maintenance@demo.carevista.co.uk');
    const { rows: residents } = await c.query(
      `SELECT id, room_number, first_name, last_name FROM residents WHERE care_home_id=$1 AND active=TRUE AND room_number IS NOT NULL ORDER BY room_number`, [chId]);

    await c.query('BEGIN');

    // ── Housekeeping logs ──
    const hkSeeded = (await c.query(`SELECT 1 FROM housekeeping_logs WHERE care_home_id=$1 LIMIT 1`, [chId])).rows.length;
    if (!hkSeeded) {
      const today = new Date();
      for (let i = 0; i < residents.length; i++) {
        const r = residents[i];
        // ~70% of rooms cleaned today, rest 1-2 days ago (so some show "overdue")
        const daysAgo = i % 10 < 7 ? 0 : (i % 2) + 1;
        const when = new Date(today); when.setDate(today.getDate() - daysAgo); when.setHours(7 + (i % 4), (i * 7) % 60, 0, 0);
        const dateStr = when.toISOString().slice(0, 10);
        for (const spec of DAILY_ROOM) {
          await c.query(
            `INSERT INTO housekeeping_logs (care_home_id, category, location_type, room_number, resident_id, specification, period_date, initials, completed_by, completed_at)
             VALUES ($1,'daily_room','resident_room',$2,$3,$4,$5,'GW',$6,$7)`,
            [chId, r.room_number, r.id, spec, dateStr, cleaning, when.toISOString()]);
        }
      }
      // a couple of communal areas today
      for (const area of ['Lounge', 'Dining Room']) {
        await c.query(
          `INSERT INTO housekeeping_logs (care_home_id, category, location_type, communal_area, specification, period_date, initials, completed_by, completed_at)
           VALUES ($1,'daily_communal','communal',$2,'General cleaning and tidy up',CURRENT_DATE,'GW',$3,NOW())`,
          [chId, area, cleaning]);
      }
      console.log(`  ✓ Housekeeping logs seeded for ${residents.length} rooms`);
    } else console.log('  • Housekeeping already seeded — skipping');

    // ── Menu options, dietary profiles, today's choices ──
    const menuSeeded = (await c.query(`SELECT 1 FROM menu_options WHERE care_home_id=$1 LIMIT 1`, [chId])).rows.length;
    if (!menuSeeded) {
      const optIds: Record<string, string[]> = { breakfast: [], lunch: [], dinner: [] };
      for (const m of MENU) {
        const { rows: [o] } = await c.query(
          `INSERT INTO menu_options (care_home_id, meal_type, name, texture, available_date, active)
           VALUES ($1,$2,$3,$4,CURRENT_DATE,TRUE) RETURNING id`, [chId, m.meal, m.name, m.texture]);
        optIds[m.meal].push(o.id);
      }
      const textures = ['normal', 'normal', 'normal', 'soft', 'normal', 'pureed', 'normal', 'normal'];
      for (let i = 0; i < residents.length; i++) {
        const r = residents[i];
        const tex = textures[i % textures.length];
        const allergies = i % 6 === 0 ? '["Dairy"]' : i % 5 === 0 ? '["Gluten"]' : '[]';
        await c.query(
          `INSERT INTO menu_dietary_profiles (care_home_id, resident_id, allergies, texture_requirement)
           VALUES ($1,$2,$3::jsonb,$4)`, [chId, r.id, allergies, tex]);
        // today's lunch + dinner choice
        for (const meal of ['lunch', 'dinner'] as const) {
          const opts = optIds[meal];
          const opt = opts[i % opts.length];
          await c.query(
            `INSERT INTO menu_choices (care_home_id, resident_id, menu_option_id, meal_date, meal_type, portion_size, submitted_by)
             VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6)`,
            [chId, r.id, opt, meal, i % 3 === 0 ? 'small' : 'regular', kitchen]);
        }
      }
      console.log(`  ✓ Menu options, dietary profiles & today's choices seeded`);
    } else console.log('  • Menu already seeded — skipping');

    // ── Room turnovers ──
    const rtSeeded = (await c.query(`SELECT 1 FROM room_turnovers WHERE care_home_id=$1 LIMIT 1`, [chId])).rows.length;
    if (!rtSeeded) {
      const turns = [
        { room: '4', status: 'in_progress', days: 2 },
        { room: '12', status: 'cleaning', days: 1 },
        { room: '20', status: 'ready', days: 4 },
      ];
      const CHECK = [
        { t: 'Deep clean all surfaces', c: 'cleaning' }, { t: 'Steam clean carpet', c: 'cleaning' },
        { t: 'Check and repair window locks', c: 'maintenance' }, { t: 'Test call bell system', c: 'maintenance' },
        { t: 'Replace mattress & bedding', c: 'cleaning' }, { t: 'Final inspection', c: 'inspection' },
      ];
      for (const t of turns) {
        const vac = new Date(); vac.setDate(vac.getDate() - t.days);
        const { rows: [rt] } = await c.query(
          `INSERT INTO room_turnovers (care_home_id, room_number, vacated_date, target_ready_date, status, assigned_to)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [chId, t.room, vac.toISOString().slice(0, 10), new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), t.status, maint]);
        for (let i = 0; i < CHECK.length; i++) {
          const done = t.status === 'ready' ? true : i < 3;
          await c.query(
            `INSERT INTO turnover_checklist_items (care_home_id, turnover_id, task_name, category, completed, completed_by, completed_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [chId, rt.id, CHECK[i].t, CHECK[i].c, done, done ? maint : null, done ? new Date().toISOString() : null]);
        }
      }
      console.log(`  ✓ Room turnovers seeded`);
    } else console.log('  • Room turnovers already seeded — skipping');

    await c.query('COMMIT');
    console.log('\n✅  Operational demo data ready.\n');
  } catch (err) {
    await c.query('ROLLBACK'); console.error('Operational seed failed:', err); throw err;
  } finally { c.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
