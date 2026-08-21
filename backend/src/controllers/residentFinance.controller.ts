import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';

// Resident personal allowance ledger.
//
// Homes routinely hold small amounts of a resident's money for hairdressing,
// chiropody, newspapers and outings. Handling it badly is a safeguarding issue
// (financial abuse) and local authorities audit it. A running balance with a
// named recorder — and a witness for cash out — is the minimum.
//
// Entries are never edited or deleted. A mistake is corrected with a
// reversing entry, exactly as a paper ledger would be.

const CATEGORIES = ['deposit','pension','hairdressing','chiropody','newspapers','toiletries',
  'outings','clothing','transport','refund','withdrawal','other'];

export const CATEGORY_LABELS: Record<string,string> = {
  deposit: 'Deposit', pension: 'Pension', hairdressing: 'Hairdressing',
  chiropody: 'Chiropody', newspapers: 'Newspapers & magazines', toiletries: 'Toiletries',
  outings: 'Outings', clothing: 'Clothing', transport: 'Transport', refund: 'Refund',
  withdrawal: 'Cash withdrawal', other: 'Other',
};

async function balanceFor(residentId: string) {
  const { rows: [b] } = await query(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS balance
     FROM resident_finance_ledger WHERE resident_id = $1`, [residentId]);
  return Number(b?.balance || 0);
}

// Home-wide view: who holds what.
export async function listBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT r.id, r.first_name, r.last_name, r.room_number,
              COALESCE(SUM(CASE WHEN l.direction = 'in' THEN l.amount ELSE -l.amount END), 0) AS balance,
              MAX(l.entry_date) AS last_entry,
              COUNT(l.id)::int AS entry_count
       FROM residents r
       LEFT JOIN resident_finance_ledger l ON l.resident_id = r.id
       WHERE r.care_home_id = $1 AND r.active = TRUE AND r.discharge_date IS NULL
       GROUP BY r.id, r.first_name, r.last_name, r.room_number
       HAVING COUNT(l.id) > 0
       ORDER BY r.last_name`, [chId]);

    const balances = rows.map(r => ({
      residentId: r.id,
      residentName: `${r.first_name} ${r.last_name}`,
      roomNumber: r.room_number,
      balance: Number(r.balance),
      lastEntry: r.last_entry,
      entryCount: r.entry_count,
      negative: Number(r.balance) < 0,
    }));

    res.json({
      residents: balances,
      totalHeld: Math.round(balances.reduce((s, b) => s + Math.max(0, b.balance), 0) * 100) / 100,
      negativeBalances: balances.filter(b => b.negative).length,
      categories: CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] || c })),
    });
  } catch (err) { next(err); }
}

export async function getLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name, room_number FROM residents
       WHERE id = $1 AND care_home_id = $2`, [req.params.residentId, chId]);
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    const { rows } = await query(
      `SELECT l.*, u.first_name || ' ' || u.last_name AS recorded_by_name,
              w.first_name || ' ' || w.last_name AS witnessed_by_name
       FROM resident_finance_ledger l
       LEFT JOIN users u ON u.id = l.recorded_by
       LEFT JOIN users w ON w.id = l.witnessed_by
       WHERE l.resident_id = $1 AND l.care_home_id = $2
       ORDER BY l.entry_date DESC, l.created_at DESC LIMIT 300`,
      [req.params.residentId, chId]);

    res.json({
      residentId: resident.id,
      residentName: `${resident.first_name} ${resident.last_name}`,
      roomNumber: resident.room_number,
      balance: await balanceFor(resident.id),
      entries: rows.map(l => ({
        id: l.id,
        entryDate: l.entry_date,
        direction: l.direction,
        amount: Number(l.amount),
        category: l.category,
        categoryLabel: CATEGORY_LABELS[l.category] || l.category,
        description: l.description,
        receiptUrl: l.receipt_url,
        recordedByName: l.recorded_by_name,
        witnessedByName: l.witnessed_by_name,
        balanceAfter: l.balance_after != null ? Number(l.balance_after) : null,
        createdAt: l.created_at,
      })),
      categories: CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] || c })),
    });
  } catch (err) { next(err); }
}

export async function addEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const residentId = b.residentId || b.resident_id;
    if (!residentId) return res.status(400).json({ error: 'A resident is required' });

    const direction = b.direction;
    if (!['in', 'out'].includes(direction)) {
      return res.status(400).json({ error: 'Say whether money is coming in or going out' });
    }
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Enter an amount greater than zero' });
    }
    const category = b.category || 'other';
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Unknown category' });
    if (!(b.description || '').trim()) {
      return res.status(400).json({ error: 'Describe what this is for — a ledger entry without a description cannot be audited' });
    }

    const { rows: [own] } = await query(
      `SELECT id FROM residents WHERE id = $1 AND care_home_id = $2`, [residentId, chId]);
    if (!own) return res.status(404).json({ error: 'Resident not found' });

    const current = await balanceFor(residentId);
    // Money out needs a second pair of eyes. This is the control that prevents
    // the most common form of financial abuse in care settings.
    const witnessId = b.witnessedBy || b.witnessed_by || null;
    if (direction === 'out' && !witnessId) {
      return res.status(400).json({ error: 'A second member of staff must witness money going out' });
    }
    if (witnessId === req.user!.id) {
      return res.status(400).json({ error: 'The witness must be a different member of staff' });
    }
    if (direction === 'out' && amount > current) {
      return res.status(409).json({
        error: `That would take the balance below zero. Currently held: £${current.toFixed(2)}.`,
      });
    }

    const after = direction === 'in' ? current + amount : current - amount;
    const { rows: [row] } = await query(
      `INSERT INTO resident_finance_ledger
         (care_home_id, resident_id, entry_date, direction, amount, category,
          description, receipt_url, recorded_by, witnessed_by, balance_after)
       VALUES ($1,$2, COALESCE($3::date, CURRENT_DATE), $4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [chId, residentId, b.entryDate || b.entry_date || null, direction, amount, category,
       b.description, b.receiptUrl || b.receipt_url || null, req.user!.id, witnessId, after]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RESIDENT_FINANCE_ENTRY', entityType: 'resident', entityId: residentId,
      afterData: { direction, amount, category, balanceAfter: after },
    });
    res.status(201).json({ id: row.id, balance: after });
  } catch (err) { next(err); }
}
