import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status, residentId, page = '1', limit = '50' } = req.query;
    let where = 'WHERE inv.care_home_id = $1'; const params: any[] = [careHomeId]; let p = 2;
    if (status) { where += ` AND inv.status = $${p++}`; params.push(status); }
    if (residentId) { where += ` AND inv.resident_id = $${p++}`; params.push(residentId); }

    const { rows } = await query(
      `SELECT inv.*, r.first_name||' '||r.last_name AS resident_name, r.room_number
       FROM invoices inv
       JOIN residents r ON r.id = inv.resident_id
       ${where}
       ORDER BY inv.period_start DESC
       LIMIT $${p} OFFSET $${p+1}`,
      [...params, parseInt(limit as string), (parseInt(page as string)-1)*parseInt(limit as string)]
    );

    // Summary totals
    const { rows: [totals] } = await query(
      `SELECT
        SUM(total_pence) AS total,
        SUM(total_pence) FILTER (WHERE status='paid') AS collected,
        SUM(total_pence) FILTER (WHERE status IN ('sent','overdue')) AS outstanding,
        COUNT(*) FILTER (WHERE status='overdue') AS overdue_count
       FROM invoices WHERE care_home_id = $1`, [careHomeId]
    );

    res.json({ invoices: rows, totals });
  } catch (err) { next(err); }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, periodStart, periodEnd, periodLabel, amountPence, vatPence,
            payerName, payerType, payerReference, dueDate, notes } = req.body;

    if (!residentId || !periodStart || !periodEnd || amountPence == null || !payerName) {
      return res.status(400).json({ error: 'residentId, periodStart, periodEnd, amountPence, and payerName are required' });
    }

    // Generate invoice number
    const { rows: [{ count }] } = await query(
      'SELECT COUNT(*) FROM invoices WHERE care_home_id = $1', [careHomeId]
    );
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(parseInt(count)+1).padStart(4,'0')}`;

    const totalPence = (amountPence || 0) + (vatPence || 0);
    const { rows: [inv] } = await query(
      `INSERT INTO invoices (
        care_home_id, resident_id, invoice_number, period_start, period_end,
        period_label, amount_pence, vat_pence, total_pence, payer_name, payer_type,
        payer_reference, due_date, notes, status, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft',$15) RETURNING *`,
      [careHomeId, residentId, invoiceNumber, periodStart, periodEnd, periodLabel,
       amountPence, vatPence || 0, totalPence, payerName, payerType,
       payerReference, dueDate, notes, req.user!.id]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'INVOICE_CREATED', entityType: 'invoice', entityId: inv.id,
      afterData: { invoiceNumber, residentId, totalPence }, ip: req.ip,
    });
    res.status(201).json(inv);
  } catch (err) { next(err); }
}

export async function updateInvoiceStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { status, paidDate, paymentReference } = req.body;

    const { rows: [inv] } = await query(
      `UPDATE invoices SET status = $1, paid_date = $2, payment_reference = $3
       WHERE id = $4 AND care_home_id = $5 RETURNING *`,
      [status, paidDate, paymentReference, id, careHomeId]
    );
    if (!inv) throw new AppError(404, 'Invoice not found');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'INVOICE_STATUS_UPDATED', entityType: 'invoice', entityId: id,
      afterData: { status, paidDate }, ip: req.ip,
    });
    res.json(inv);
  } catch (err) { next(err); }
}

// ── Billing summary ────────────────────────────────────────────────────────
export async function getBillingSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count,
         COUNT(*) FILTER (WHERE status = 'overdue')::int AS overdue_count,
         COUNT(*) FILTER (WHERE status = 'draft' OR status = 'sent')::int AS pending_count,
         COALESCE(SUM(total_pence) FILTER (WHERE status = 'paid'), 0)::numeric AS paid_total,
         COALESCE(SUM(total_pence) FILTER (WHERE status = 'overdue'), 0)::numeric AS overdue_total,
         COALESCE(SUM(total_pence) FILTER (WHERE status IN ('draft','sent')), 0)::numeric AS pending_total,
         COALESCE(SUM(total_pence) FILTER (WHERE date_part('month', period_start) = date_part('month', NOW()) AND date_part('year', period_start) = date_part('year', NOW())), 0)::numeric AS this_month_revenue
       FROM invoices WHERE care_home_id = $1`,
      [careHomeId]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
}
