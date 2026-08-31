import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../models/db';
import { auditLog } from '../services/audit.service';
import { readSpreadsheet } from '../utils/xlsx';
import { makeTemporaryPassword } from '../utils/tempPassword';

// ─────────────────────────────────────────────────────────────────────────────
// Managing a team.
//
// Three things were missing and one of them mattered a great deal: there was no
// way to deactivate anybody. A carer who left in March could still sign in in
// September, because the only thing a manager could edit was a job title. That
// is a safeguarding and data-protection failure, not a missing convenience, so
// the leaver flow below deactivates the login immediately while keeping the
// person's record and every care note they ever wrote.
// ─────────────────────────────────────────────────────────────────────────────

const LEAVING_REASONS = ['resigned','end_of_contract','retired','dismissed','redundancy',
                         'transferred','deceased','other'];

// ── Leavers ─────────────────────────────────────────────────────────────────
export async function deactivateStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const reason = b.leavingReason || b.leaving_reason;
    if (!reason || !LEAVING_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Record why this person is leaving' });
    }

    const { rows: [sp] } = await query(
      `SELECT sp.*, u.id AS user_id, u.first_name, u.last_name, u.role
       FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1 AND sp.care_home_id = $2`, [req.params.id, chId]);
    if (!sp) return res.status(404).json({ error: 'Staff member not found' });

    // Nobody may remove their own access — that is how a home locks itself out.
    if (sp.user_id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }
    // Never leave a home with no manager.
    if (['home_manager', 'super_admin', 'group_admin'].includes(sp.role)) {
      const { rows: [{ n }] } = await query(
        `SELECT COUNT(*)::int AS n FROM users
         WHERE care_home_id = $1 AND active = TRUE AND id <> $2
           AND role IN ('home_manager','super_admin','group_admin')`, [chId, sp.user_id]);
      if (n === 0) {
        return res.status(409).json({
          error: 'This is the only active manager. Add another manager before deactivating this one.',
        });
      }
    }

    const leavingDate = b.leavingDate || b.leaving_date || null;

    // Count before deleting, so the manager is told what the rota just lost.
    const { rows: [{ n: futureShifts }] } = await query(
      `SELECT COUNT(*)::int AS n FROM shifts WHERE staff_id = $1 AND shift_date > CURRENT_DATE`,
      [req.params.id]);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE staff_profiles
         SET end_date = COALESCE($1::date, CURRENT_DATE), leaving_reason = $2,
             leaving_notes = $3, deactivated_by = $4, updated_at = NOW()
         WHERE id = $5`,
        [leavingDate, reason, b.notes || null, req.user!.id, req.params.id]);

      // The login stops working now, whatever the leaving date says.
      await client.query(`UPDATE users SET active = FALSE, updated_at = NOW() WHERE id = $1`, [sp.user_id]);

      // Future shifts must not silently stand: the rota would look covered when
      // it is not. Remove them and tell the manager how many.
      await client.query(
        `DELETE FROM shifts WHERE staff_id = $1 AND shift_date > CURRENT_DATE`, [req.params.id]);
    });

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'STAFF_DEACTIVATED', entityType: 'staff', entityId: req.params.id,
      afterData: { name: `${sp.first_name} ${sp.last_name}`, reason, leavingDate, futureShiftsRemoved: futureShifts },
    });

    res.json({
      ok: true,
      futureShiftsRemoved: futureShifts,
      message: `${sp.first_name} ${sp.last_name} can no longer sign in. Their record and all their care notes are kept.`
        + (futureShifts > 0
            ? ` ${futureShifts} future shift${futureShifts === 1 ? '' : 's'} removed from the rota — those need covering.`
            : ''),
    });
  } catch (err) { next(err); }
}

export async function reactivateStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [sp] } = await query(
      `SELECT sp.id, sp.user_id, u.first_name, u.last_name
       FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1 AND sp.care_home_id = $2`, [req.params.id, chId]);
    if (!sp) return res.status(404).json({ error: 'Staff member not found' });

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE staff_profiles SET end_date = NULL, leaving_reason = NULL,
                leaving_notes = NULL, updated_at = NOW() WHERE id = $1`, [req.params.id]);
      await client.query(`UPDATE users SET active = TRUE, updated_at = NOW() WHERE id = $1`, [sp.user_id]);
    });

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'STAFF_REACTIVATED', entityType: 'staff', entityId: req.params.id,
      afterData: { name: `${sp.first_name} ${sp.last_name}` },
    });
    res.json({ ok: true, message: `${sp.first_name} ${sp.last_name} can sign in again.` });
  } catch (err) { next(err); }
}

// ── Full profile update, including name and role ────────────────────────────
// The previous update touched only job title, hours, rate and DBS — a change of
// name or role was impossible.
export async function updateStaffFull(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const { rows: [sp] } = await query(
      `SELECT sp.id, sp.user_id, u.role FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1 AND sp.care_home_id = $2`, [req.params.id, chId]);
    if (!sp) return res.status(404).json({ error: 'Staff member not found' });

    const role = b.role || null;
    const VALID = ['home_manager','deputy_manager','registered_nurse','senior_carer','carer',
                   'activities','kitchen','cleaning','maintenance','admin','finance'];
    if (role && !VALID.includes(role)) return res.status(400).json({ error: 'Unknown role' });

    // Demoting the last manager locks everyone out of the settings.
    if (role && sp.user_id === req.user!.id && !['home_manager','super_admin','group_admin'].includes(role)) {
      return res.status(400).json({ error: 'You cannot remove your own manager access.' });
    }

    await withTransaction(async (client) => {
      if (b.firstName || b.lastName || role || b.phone !== undefined || b.email) {
        await client.query(
          `UPDATE users SET
             first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
             role = COALESCE($3, role), phone = COALESCE($4, phone),
             email = COALESCE($5, email), updated_at = NOW()
           WHERE id = $6`,
          [b.firstName || null, b.lastName || null, role, b.phone ?? null,
           b.email ? String(b.email).toLowerCase().trim() : null, sp.user_id]);
      }
      await client.query(
        `UPDATE staff_profiles SET
           job_title = COALESCE($1, job_title), department = COALESCE($2, department),
           contract_hours = COALESCE($3, contract_hours), hourly_rate = COALESCE($4, hourly_rate),
           dbs_number = COALESCE($5, dbs_number), dbs_expires = COALESCE($6, dbs_expires),
           nmc_pin = COALESCE($7, nmc_pin), start_date = COALESCE($8, start_date),
           employee_number = COALESCE($9, employee_number),
           right_to_work_checked = COALESCE($10, right_to_work_checked),
           right_to_work_expires = COALESCE($11, right_to_work_expires),
           emergency_contact_name = COALESCE($12, emergency_contact_name),
           emergency_contact_phone = COALESCE($13, emergency_contact_phone),
           updated_at = NOW()
         WHERE id = $14`,
        [b.jobTitle || null, b.department || null, b.contractHours ?? null, b.hourlyRate ?? null,
         b.dbsNumber || null, b.dbsExpires || null, b.nmcPin || null, b.startDate || null,
         b.employeeNumber || null,
         b.rightToWorkChecked === undefined ? null : b.rightToWorkChecked === true,
         b.rightToWorkExpires || null, b.emergencyContactName || null,
         b.emergencyContactPhone || null, req.params.id]);
    });

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'STAFF_UPDATED', entityType: 'staff', entityId: req.params.id,
      afterData: { role, jobTitle: b.jobTitle },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Working preferences and unavailability.
//
// In a sector with the turnover this one has, repeatedly rostering somebody on
// the day they collect their children is how you lose them. Recording it costs
// a minute; not recording it costs a carer.
// ─────────────────────────────────────────────────────────────────────────────

const SHIFTS = ['day', 'evening', 'night'];
const KINDS = ['unavailable','prefer_not','annual_leave','training','fixed_commitment','parental','medical'];

export async function getStaffWorking(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [prefs] } = await query(
      `SELECT * FROM staff_preferences WHERE staff_id = $1 AND care_home_id = $2`,
      [req.params.id, chId]);
    const { rows: unavail } = await query(
      `SELECT * FROM staff_unavailability WHERE staff_id = $1 AND care_home_id = $2
       ORDER BY weekday NULLS LAST, from_date`, [req.params.id, chId]);

    res.json({
      preferences: prefs ? {
        preferredShifts: prefs.preferred_shifts || [],
        avoidShifts: prefs.avoid_shifts || [],
        maxHoursPerWeek: prefs.max_hours_per_week != null ? Number(prefs.max_hours_per_week) : null,
        maxConsecutiveDays: prefs.max_consecutive_days,
        minHoursBetweenShifts: prefs.min_hours_between_shifts,
        wantsMoreHours: prefs.wants_more_hours,
        canDoOvertime: prefs.can_do_overtime,
        worksAloneOk: prefs.works_alone_ok,
        notes: prefs.notes,
      } : null,
      unavailability: unavail.map(u => ({
        id: u.id, kind: u.kind, weekday: u.weekday,
        fromDate: u.from_date, toDate: u.to_date,
        fromTime: u.from_time, toTime: u.to_time,
        reason: u.reason, approved: u.approved,
      })),
    });
  } catch (err) { next(err); }
}

export async function setStaffPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const pref = (arr: any) => Array.isArray(arr) ? arr.filter((x: string) => SHIFTS.includes(x)) : [];

    const { rows: [own] } = await query(
      `SELECT id FROM staff_profiles WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!own) return res.status(404).json({ error: 'Staff member not found' });

    const maxHours = b.maxHoursPerWeek ?? null;
    if (maxHours != null && (Number(maxHours) < 1 || Number(maxHours) > 80)) {
      return res.status(400).json({ error: 'Maximum weekly hours should be between 1 and 80' });
    }

    await query(
      `INSERT INTO staff_preferences
         (care_home_id, staff_id, preferred_shifts, avoid_shifts, max_hours_per_week,
          max_consecutive_days, min_hours_between_shifts, wants_more_hours,
          can_do_overtime, works_alone_ok, notes, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (staff_id) DO UPDATE SET
         preferred_shifts = EXCLUDED.preferred_shifts,
         avoid_shifts = EXCLUDED.avoid_shifts,
         max_hours_per_week = EXCLUDED.max_hours_per_week,
         max_consecutive_days = EXCLUDED.max_consecutive_days,
         min_hours_between_shifts = EXCLUDED.min_hours_between_shifts,
         wants_more_hours = EXCLUDED.wants_more_hours,
         can_do_overtime = EXCLUDED.can_do_overtime,
         works_alone_ok = EXCLUDED.works_alone_ok,
         notes = EXCLUDED.notes, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [chId, req.params.id, pref(b.preferredShifts), pref(b.avoidShifts), maxHours,
       b.maxConsecutiveDays ?? null, b.minHoursBetweenShifts ?? 11,
       b.wantsMoreHours === true, b.canDoOvertime !== false, b.worksAloneOk !== false,
       b.notes || null, req.user!.id]);

    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function addUnavailability(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const kind = b.kind || 'unavailable';
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown type' });

    const weekday = b.weekday === undefined || b.weekday === null || b.weekday === '' ? null : Number(b.weekday);
    const fromDate = b.fromDate || b.from_date || null;
    if (weekday === null && !fromDate) {
      return res.status(400).json({ error: 'Choose either a repeating day of the week, or a date range.' });
    }
    if (weekday !== null && (weekday < 0 || weekday > 6)) {
      return res.status(400).json({ error: 'Day of the week is out of range' });
    }
    const toDate = b.toDate || b.to_date || null;
    if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
      return res.status(400).json({ error: 'The end date is before the start date' });
    }

    const { rows: [row] } = await query(
      `INSERT INTO staff_unavailability
         (care_home_id, staff_id, kind, weekday, from_date, to_date, from_time, to_time, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [chId, req.params.id, kind, weekday, fromDate, toDate,
       b.fromTime || null, b.toTime || null, b.reason || null, req.user!.id]);

    res.status(201).json({ id: row.id });
  } catch (err) { next(err); }
}

export async function deleteUnavailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { rowCount } = await query(
      `DELETE FROM staff_unavailability WHERE id = $1 AND care_home_id = $2`,
      [req.params.entryId, req.user!.care_home_id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── Rota conflicts ──────────────────────────────────────────────────────────
// Checks shifts already on the rota against what staff have told us. Reports;
// never blocks — sometimes a manager has to ask, and the point is that they
// know they are asking.
export async function rotaConflicts(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const from = String(req.query.from || new Date().toISOString().slice(0, 10));
    const to = String(req.query.to || '');
    const toDate = to || new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);

    const { rows: shifts } = await query(
      `SELECT s.id, s.staff_id, s.shift_date, s.shift_type, s.start_time, s.end_time,
              u.first_name || ' ' || u.last_name AS staff_name,
              EXTRACT(DOW FROM s.shift_date)::int AS weekday
       FROM shifts s
       JOIN staff_profiles sp ON sp.id = s.staff_id
       JOIN users u ON u.id = sp.user_id
       WHERE s.care_home_id = $1 AND s.shift_date BETWEEN $2::date AND $3::date
       ORDER BY s.shift_date`, [chId, from, toDate]);

    const { rows: unavail } = await query(
      `SELECT * FROM staff_unavailability WHERE care_home_id = $1`, [chId]);
    const { rows: prefs } = await query(
      `SELECT * FROM staff_preferences WHERE care_home_id = $1`, [chId]);
    const prefBy = new Map(prefs.map(p => [p.staff_id, p]));

    const conflicts: any[] = [];

    for (const s of shifts) {
      for (const u of unavail.filter(x => x.staff_id === s.staff_id)) {
        const dayMatch = u.weekday !== null && u.weekday === s.weekday;
        const dateMatch = u.from_date &&
          new Date(s.shift_date) >= new Date(u.from_date) &&
          (!u.to_date || new Date(s.shift_date) <= new Date(u.to_date));
        if (!dayMatch && !dateMatch) continue;
        conflicts.push({
          shiftId: s.id, staffId: s.staff_id, staffName: s.staff_name,
          date: s.shift_date, shiftType: s.shift_type,
          severity: u.kind === 'prefer_not' ? 'soft' : 'hard',
          reason: u.kind === 'prefer_not'
            ? `${s.staff_name} would rather not work this day${u.reason ? ` (${u.reason})` : ''}.`
            : `${s.staff_name} is unavailable${u.reason ? ` — ${u.reason}` : ''}.`,
        });
      }

      const p: any = prefBy.get(s.staff_id);
      if (p && Array.isArray(p.avoid_shifts) && p.avoid_shifts.includes(s.shift_type)) {
        conflicts.push({
          shiftId: s.id, staffId: s.staff_id, staffName: s.staff_name,
          date: s.shift_date, shiftType: s.shift_type, severity: 'soft',
          reason: `${s.staff_name} has asked not to be given ${s.shift_type} shifts.`,
        });
      }
    }

    // Weekly hours against each person's stated maximum.
    const byStaffWeek = new Map<string, number>();
    for (const s of shifts) {
      const d = new Date(s.shift_date);
      const week = `${s.staff_id}|${new Date(d.getTime() - d.getDay() * 86400000).toISOString().slice(0, 10)}`;
      const hrs = s.start_time && s.end_time
        ? (() => {
            const [sh, sm] = String(s.start_time).split(':').map(Number);
            const [eh, em] = String(s.end_time).split(':').map(Number);
            let h = (eh * 60 + em - sh * 60 - sm) / 60;
            if (h <= 0) h += 24;      // a night shift crosses midnight
            return h;
          })()
        : 8;
      byStaffWeek.set(week, (byStaffWeek.get(week) || 0) + hrs);
    }
    for (const [key, hours] of byStaffWeek) {
      const [staffId, weekStart] = key.split('|');
      const p: any = prefBy.get(staffId);
      const max = p?.max_hours_per_week != null ? Number(p.max_hours_per_week) : null;
      if (max && hours > max) {
        const name = shifts.find(s => s.staff_id === staffId)?.staff_name || 'This person';
        conflicts.push({
          staffId, staffName: name, date: weekStart, severity: 'soft',
          reason: `${name} is rostered ${Math.round(hours)} hours in the week of ${weekStart}, above their stated maximum of ${max}.`,
        });
      }
    }

    res.json({
      from, to: toDate, shiftsChecked: shifts.length,
      conflicts,
      hard: conflicts.filter(c => c.severity === 'hard').length,
      soft: conflicts.filter(c => c.severity === 'soft').length,
    });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk import.
//
// Onboarding a 40-bed home means typing in forty staff. That is most of a day,
// and it is the point at which a pilot quietly dies. Managers already keep this
// list in Excel, so read the file they have.
//
// Every import is a dry run first. Nothing is written until the manager has
// seen exactly what will happen to each row.
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<string, string> = {
  'first name': 'firstName', 'firstname': 'firstName', 'forename': 'firstName',
  'last name': 'lastName', 'lastname': 'lastName', 'surname': 'lastName',
  'email': 'email', 'email address': 'email', 'e-mail': 'email',
  'role': 'role', 'job title': 'jobTitle', 'jobtitle': 'jobTitle', 'position': 'jobTitle',
  'phone': 'phone', 'mobile': 'phone', 'telephone': 'phone',
  'contract hours': 'contractHours', 'hours': 'contractHours',
  'hourly rate': 'hourlyRate', 'rate': 'hourlyRate', 'pay': 'hourlyRate',
  'start date': 'startDate', 'started': 'startDate',
  'dbs number': 'dbsNumber', 'dbs': 'dbsNumber',
  'dbs expires': 'dbsExpires', 'dbs expiry': 'dbsExpires',
  'employee number': 'employeeNumber', 'staff number': 'employeeNumber',
  'nmc pin': 'nmcPin', 'nmc': 'nmcPin',
  'department': 'department',
};

const ROLE_ALIASES: Record<string, string> = {
  'manager': 'home_manager', 'home manager': 'home_manager', 'registered manager': 'home_manager',
  'deputy': 'deputy_manager', 'deputy manager': 'deputy_manager',
  'nurse': 'registered_nurse', 'rgn': 'registered_nurse', 'registered nurse': 'registered_nurse',
  'senior': 'senior_carer', 'senior carer': 'senior_carer', 'team leader': 'senior_carer',
  'carer': 'carer', 'care assistant': 'carer', 'hca': 'carer', 'support worker': 'carer',
  'activities': 'activities', 'activities coordinator': 'activities',
  'kitchen': 'kitchen', 'chef': 'kitchen', 'cook': 'kitchen',
  'cleaner': 'cleaning', 'housekeeping': 'cleaning', 'domestic': 'cleaning',
  'maintenance': 'maintenance', 'handyman': 'maintenance',
  'admin': 'admin', 'administrator': 'admin', 'finance': 'finance',
};

export async function importStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: 'Attach a spreadsheet to import' });

    let grid: string[][];
    try {
      grid = readSpreadsheet(file.buffer, file.originalname || '');
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'That file could not be read' });
    }
    if (grid.length < 2) {
      return res.status(400).json({ error: 'The file needs a header row and at least one person' });
    }

    // Map whatever the manager called their columns onto our fields.
    const headers = grid[0].map(h => HEADER_ALIASES[h.toLowerCase().trim()] || null);
    if (!headers.includes('firstName') || !headers.includes('lastName') || !headers.includes('email')) {
      return res.status(400).json({
        error: 'The file needs at least First name, Last name and Email columns.',
        columnsFound: grid[0],
      });
    }

    const dryRun = String(req.query.commit || '') !== 'true';
    const results: any[] = [];

    for (let r = 1; r < grid.length; r++) {
      const row = grid[r];
      if (row.every(c => !c)) continue;
      const rec: any = {};
      headers.forEach((h, i) => { if (h) rec[h] = row[i] || ''; });

      const line = r + 1;
      const email = String(rec.email || '').toLowerCase().trim();

      if (!rec.firstName || !rec.lastName || !email) {
        results.push({ line, name: `${rec.firstName || ''} ${rec.lastName || ''}`.trim() || '(blank)',
                       status: 'skipped', reason: 'Missing name or email' });
        continue;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        results.push({ line, name: `${rec.firstName} ${rec.lastName}`, status: 'skipped',
                       reason: `"${email}" is not a valid email address` });
        continue;
      }

      const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.length) {
        results.push({ line, name: `${rec.firstName} ${rec.lastName}`, email,
                       status: 'skipped', reason: 'Already has an account' });
        continue;
      }

      const rawRole = String(rec.role || rec.jobTitle || 'carer').toLowerCase().trim();
      const role = ROLE_ALIASES[rawRole] || 'carer';

      if (dryRun) {
        results.push({ line, name: `${rec.firstName} ${rec.lastName}`, email, role,
                       status: 'will_create',
                       note: ROLE_ALIASES[rawRole] ? undefined : `Role "${rec.role || '—'}" not recognised, will be set to Carer` });
        continue;
      }

      // A cryptographically random one-time password, returned to the manager
      // to hand over. must_change_password below forces a change at first
      // sign-in, so it stops working the moment it has been used.
      const temp = makeTemporaryPassword();
      const hash = await bcrypt.hash(temp, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));

      try {
        await withTransaction(async (client) => {
          const { rows: [user] } = await client.query(
            `INSERT INTO users (care_home_id, email, password_hash, role, first_name, last_name, phone,
                                must_change_password)
             VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id`,
            [chId, email, hash, role, rec.firstName.trim(), rec.lastName.trim(), rec.phone || null]);
          await client.query(
            `INSERT INTO staff_profiles
               (user_id, care_home_id, employee_number, job_title, department, start_date,
                contract_hours, hourly_rate, dbs_number, dbs_expires, nmc_pin)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [user.id, chId, rec.employeeNumber || null, rec.jobTitle || null, rec.department || null,
             rec.startDate || null,
             rec.contractHours ? Number(rec.contractHours) || null : null,
             rec.hourlyRate ? Number(String(rec.hourlyRate).replace(/[£,]/g, '')) || null : null,
             rec.dbsNumber || null, rec.dbsExpires || null, rec.nmcPin || null]);
        });
        // The one-time password goes back to the manager exactly once, in this
        // response. It is never stored in readable form and never emailed.
        results.push({ line, name: `${rec.firstName} ${rec.lastName}`, email, role,
                       status: 'created', temporaryPassword: temp });
      } catch (e: any) {
        results.push({ line, name: `${rec.firstName} ${rec.lastName}`, email,
                       status: 'failed', reason: e?.message || 'Could not be created' });
      }
    }

    if (!dryRun) {
      await auditLog({
        careHomeId: chId, actorId: req.user!.id,
        actorName: `${req.user!.first_name} ${req.user!.last_name}`,
        action: 'STAFF_BULK_IMPORTED', entityType: 'staff',
        afterData: { created: results.filter(r => r.status === 'created').length },
      });
    }

    const created = results.filter(r => r.status === 'created').length;
    const willCreate = results.filter(r => r.status === 'will_create').length;
    res.json({
      dryRun, results,
      summary: {
        rows: results.length,
        willCreate, created,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: results.filter(r => r.status === 'failed').length,
      },
      message: dryRun
        ? `${willCreate} of ${results.length} rows will be added. Nothing has been saved yet.`
        : `${created} added. Each person sets their own password using "Forgotten password" on the sign-in page.`,
    });
  } catch (err) { next(err); }
}

/** The template a manager downloads so the columns are right first time. */
export function staffImportTemplate(_req: Request, res: Response) {
  const rows = [
    ['First name','Last name','Email','Role','Job title','Phone','Contract hours','Hourly rate','Start date','DBS number','DBS expires'],
    ['Amara','Osei','amara.osei@example.co.uk','Senior carer','Senior Carer','07700900001','37.5','13.50','2024-03-01','001234567890','2027-03-01'],
    ['Daniel','Hughes','daniel.hughes@example.co.uk','Carer','Care Assistant','07700900002','24','12.20','2025-01-15','001234567891','2028-01-15'],
  ];
  const csv = '﻿' + rows.map(r => r.map(c => /[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="carevista-staff-template.csv"');
  res.send(csv);
}
