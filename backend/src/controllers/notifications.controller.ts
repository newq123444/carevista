// src/controllers/notifications.controller.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

let sseManager: any = { broadcast: () => {} };
try { sseManager = require('../utils/sse').sseManager; } catch {}

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { rows } = await query(
      `SELECT * FROM notifications WHERE care_home_id=$1 AND (user_id=$2 OR user_id IS NULL)
       ORDER BY created_at DESC LIMIT 50`,
      [careHomeId, userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await query('UPDATE notifications SET read_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    await query(
      `UPDATE notifications SET read_at=NOW()
       WHERE care_home_id=$1 AND (user_id=$2 OR user_id IS NULL) AND read_at IS NULL`,
      [careHomeId, userId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function createNotification(params: {
  careHomeId: string; userId?: string; type: string;
  title: string; body?: string; entityType?: string;
  entityId?: string; priority?: string;
}) {
  try {
    const { rows: [n] } = await query(
      `INSERT INTO notifications (care_home_id,user_id,type,title,body,entity_type,entity_id,priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [params.careHomeId, params.userId||null, params.type, params.title,
       params.body||null, params.entityType||null, params.entityId||null, params.priority||'normal']
    );
    sseManager.broadcast(params.careHomeId, { type: 'NOTIFICATION', notification: n });
    return n;
  } catch {}
}

export async function generateAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    let created = 0;

    // DBS expiring within 30 days
    const { rows: dbsStaff } = await query(
      `SELECT sp.id, u.first_name||' '||u.last_name AS name, sp.dbs_expires
       FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
       WHERE sp.care_home_id=$1 AND sp.dbs_expires BETWEEN NOW() AND NOW()+INTERVAL '30 days'`,
      [careHomeId]
    );
    for (const s of dbsStaff) {
      const { rows: ex } = await query(
        `SELECT id FROM notifications WHERE care_home_id=$1 AND type='dbs_expiring' AND entity_id=$2 AND created_at>NOW()-INTERVAL '7 days'`,
        [careHomeId, s.id]
      );
      if (ex.length === 0) {
        await createNotification({ careHomeId, type:'dbs_expiring', priority:'high',
          title:`DBS expiring — ${s.name}`,
          body:`DBS expires ${new Date(s.dbs_expires).toLocaleDateString('en-GB')}. Renew immediately.`,
          entityType:'staff', entityId:s.id });
        created++;
      }
    }

    // Missed meds today
    const { rows: missed } = await query(
      `SELECT r.first_name||' '||r.last_name AS name, r.room_number, COUNT(*) AS cnt
       FROM med_administrations ma JOIN residents r ON r.id=ma.resident_id
       WHERE ma.care_home_id=$1 AND ma.administration_date=CURRENT_DATE AND ma.status='missed'
       GROUP BY r.id,r.first_name,r.last_name,r.room_number`,
      [careHomeId]
    );
    for (const m of missed) {
      await createNotification({ careHomeId, type:'missed_medication', priority:'urgent',
        title:`Missed medication — ${m.name} (Room ${m.room_number})`,
        body:`${m.cnt} dose(s) missed today. Please review.` });
      created++;
    }

    // Overdue compliance actions
    const { rows: overdue } = await query(
      `SELECT COUNT(*) AS cnt FROM compliance_actions
       WHERE care_home_id=$1 AND status!='closed' AND due_date<CURRENT_DATE`,
      [careHomeId]
    );
    if (parseInt(overdue[0].cnt) > 0) {
      await createNotification({ careHomeId, type:'compliance_overdue', priority:'high',
        title:`${overdue[0].cnt} compliance action(s) overdue`,
        body:`CQC compliance actions are past their due date. Review immediately.` });
      created++;
    }

    res.json({ generated: created });
  } catch (err) { next(err); }
}
