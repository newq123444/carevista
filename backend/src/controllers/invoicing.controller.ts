import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

// ── Rate Uplifts ──────────────────────────────────────────────────────────

export async function listRateUplifts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status, residentId } = req.query;
    let where = 'WHERE ru.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (status) { where += ` AND ru.status = $${p++}`; params.push(status); }
    if (residentId) { where += ` AND ru.resident_id = $${p++}`; params.push(residentId); }

    const { rows } = await query(
      `SELECT ru.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM rate_uplifts ru
       JOIN residents r ON r.id = ru.resident_id
       ${where}
       ORDER BY ru.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function createRateUplift(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, previousRatePence, newRatePence, effectiveDate, reason } = req.body;

    if (!residentId || previousRatePence == null || newRatePence == null || !effectiveDate) {
      return res.status(400).json({ error: 'residentId, previousRatePence, newRatePence, and effectiveDate are required' });
    }

    const { rows: [uplift] } = await query(
      `INSERT INTO rate_uplifts (care_home_id, resident_id, previous_rate_pence, new_rate_pence, effective_date, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [careHomeId, residentId, previousRatePence, newRatePence, effectiveDate, reason]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RATE_UPLIFT_CREATED', entityType: 'rate_uplift', entityId: uplift.id,
      afterData: { residentId, previousRatePence, newRatePence, effectiveDate }, ip: req.ip,
    });
    res.status(201).json(uplift);
  } catch (err) { next(err); }
}

export async function approveRateUplift(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { status } = req.body;

    if (!['approved', 'rejected', 'applied'].includes(status)) {
      throw new AppError(400, 'Invalid status');
    }

    const { rows: [uplift] } = await query(
      `UPDATE rate_uplifts SET status = $1, approved_by = $2
       WHERE id = $3 AND care_home_id = $4 RETURNING *`,
      [status, req.user!.id, id, careHomeId]
    );
    if (!uplift) throw new AppError(404, 'Rate uplift not found');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RATE_UPLIFT_UPDATED', entityType: 'rate_uplift', entityId: id,
      afterData: { status }, ip: req.ip,
    });
    res.json(uplift);
  } catch (err) { next(err); }
}

// ── Payment Reminders ─────────────────────────────────────────────────────

export async function sendPaymentReminder(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { invoiceId, reminderType, channel } = req.body;

    if (!invoiceId || !reminderType) {
      return res.status(400).json({ error: 'invoiceId and reminderType are required' });
    }

    const { rows: [reminder] } = await query(
      `INSERT INTO payment_reminders (care_home_id, invoice_id, reminder_type, channel, status, sent_at)
       VALUES ($1, $2, $3, $4, 'sent', NOW()) RETURNING *`,
      [careHomeId, invoiceId, reminderType, channel]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'PAYMENT_REMINDER_SENT', entityType: 'payment_reminder', entityId: reminder.id,
      afterData: { invoiceId, reminderType, channel }, ip: req.ip,
    });
    res.status(201).json(reminder);
  } catch (err) { next(err); }
}

export async function listPaymentReminders(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { invoiceId } = req.query;
    let where = 'WHERE care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (invoiceId) { where += ` AND invoice_id = $${p++}`; params.push(invoiceId); }

    const { rows } = await query(
      `SELECT * FROM payment_reminders ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Revenue Dashboard ─────────────────────────────────────────────────────

export async function getRevenueDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows: [totals] } = await query(
      `SELECT
        COALESCE(SUM(total_pence) FILTER (WHERE status = 'paid'), 0)::int AS total_collected_pence,
        COALESCE(SUM(total_pence) FILTER (WHERE status IN ('sent','overdue')), 0)::int AS outstanding_pence,
        COALESCE(SUM(total_pence) FILTER (WHERE status = 'overdue'), 0)::int AS overdue_pence,
        COUNT(*) FILTER (WHERE status = 'overdue')::int AS overdue_count
       FROM invoices WHERE care_home_id = $1`,
      [careHomeId]
    );

    const { rows: monthlyRevenue } = await query(
      `SELECT date_trunc('month', period_start)::date AS month,
        SUM(total_pence)::int AS revenue_pence,
        COUNT(*)::int AS invoice_count
       FROM invoices WHERE care_home_id = $1
       GROUP BY date_trunc('month', period_start)
       ORDER BY month DESC LIMIT 12`,
      [careHomeId]
    );

    const { rows: paymentStatusBreakdown } = await query(
      `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total_pence), 0)::int AS total_pence
       FROM invoices WHERE care_home_id = $1
       GROUP BY status`,
      [careHomeId]
    );

    res.json({ totals, monthlyRevenue, paymentStatusBreakdown });
  } catch (err) { next(err); }
}
