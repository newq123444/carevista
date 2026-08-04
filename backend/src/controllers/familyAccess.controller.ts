import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../models/db';

const rounds = () => parseInt(process.env.BCRYPT_ROUNDS || '12');
const genCode = () => crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 10);
const genPass = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[crypto.randomInt(chars.length)];
  return s + crypto.randomInt(1000, 9999) + '!';
};

// GET /family-access — residents with linked family members + pending invites
export async function listFamilyAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const links = await query(
      `SELECT fl.id, fl.resident_id, fl.relationship, fl.is_primary,
              r.first_name AS resident_first, r.last_name AS resident_last, r.room_number,
              u.id AS user_id, u.first_name, u.last_name, u.email, u.active, u.last_login
       FROM family_links fl
       JOIN users u ON u.id = fl.user_id
       JOIN residents r ON r.id = fl.resident_id
       WHERE fl.care_home_id = $1 ORDER BY r.last_name, u.last_name`, [chId]);
    const invites = await query(
      `SELECT fi.id, fi.resident_id, fi.email, fi.code, fi.relationship, fi.status, fi.created_at, fi.expires_at,
              r.first_name AS resident_first, r.last_name AS resident_last
       FROM family_invites fi JOIN residents r ON r.id = fi.resident_id
       WHERE fi.care_home_id = $1 AND fi.status = 'pending' ORDER BY fi.created_at DESC`, [chId]);
    res.json({ links: links.rows, invites: invites.rows });
  } catch (err) { next(err); }
}

// POST /family-access/provision {residentId,email,firstName,lastName,relationship}
export async function provisionFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { residentId, email, firstName, lastName, relationship } = req.body;
    if (!residentId || !email || !firstName || !lastName)
      return res.status(400).json({ error: 'residentId, email, firstName and lastName are required' });
    const r = await query(`SELECT id FROM residents WHERE id=$1 AND care_home_id=$2`, [residentId, chId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Resident not found' });
    const em = String(email).toLowerCase().trim();
    const exists = await query(`SELECT id, role FROM users WHERE email=$1`, [em]);
    let userId: string; let tempPassword: string | undefined;
    if (exists.rows[0]) {
      if (exists.rows[0].role !== 'family')
        return res.status(409).json({ error: 'That email already belongs to a staff account' });
      userId = exists.rows[0].id;
    } else {
      tempPassword = genPass();
      const hash = await bcrypt.hash(tempPassword, rounds());
      const ins = await query(
        `INSERT INTO users (care_home_id,email,password_hash,role,first_name,last_name)
         VALUES ($1,$2,$3,'family',$4,$5) RETURNING id`, [chId, em, hash, firstName, lastName]);
      userId = ins.rows[0].id;
    }
    await query(
      `INSERT INTO family_links (care_home_id,resident_id,user_id,relationship,is_primary)
       VALUES ($1,$2,$3,$4, NOT EXISTS(SELECT 1 FROM family_links WHERE resident_id=$2))
       ON CONFLICT (resident_id,user_id) DO UPDATE SET relationship=EXCLUDED.relationship`,
      [chId, residentId, userId, relationship || null]);
    await query(
      `UPDATE residents SET family_portal_access=TRUE, family_portal_user_id=COALESCE(family_portal_user_id,$2)
       WHERE id=$1`, [residentId, userId]);
    res.status(201).json({
      userId, email: em, tempPassword,
      note: tempPassword ? 'Share this email and temporary password with the family member.'
                         : 'Existing family account linked to this resident.',
    });
  } catch (err) { next(err); }
}

// POST /family-access/invite {residentId,email,relationship}
export async function createFamilyInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { residentId, email, relationship } = req.body;
    if (!residentId) return res.status(400).json({ error: 'residentId is required' });
    const r = await query(`SELECT id FROM residents WHERE id=$1 AND care_home_id=$2`, [residentId, chId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Resident not found' });
    const code = genCode();
    const ins = await query(
      `INSERT INTO family_invites (care_home_id,resident_id,email,code,relationship,created_by,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6, NOW() + INTERVAL '30 days') RETURNING id, code, expires_at`,
      [chId, residentId, email ? String(email).toLowerCase().trim() : null, code, relationship || null, req.user!.id]);
    res.status(201).json(ins.rows[0]);
  } catch (err) { next(err); }
}

// POST /family-access/:linkId/revoke
export async function revokeFamilyLink(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const link = await query(`SELECT user_id, resident_id FROM family_links WHERE id=$1 AND care_home_id=$2`,
      [req.params.linkId, chId]);
    if (!link.rows[0]) return res.status(404).json({ error: 'Link not found' });
    await query(`DELETE FROM family_links WHERE id=$1`, [req.params.linkId]);
    const rem = await query(`SELECT COUNT(*)::int AS n FROM family_links WHERE user_id=$1`, [link.rows[0].user_id]);
    if (rem.rows[0].n === 0)
      await query(`UPDATE users SET active=FALSE WHERE id=$1 AND role='family'`, [link.rows[0].user_id]);
    const still = await query(`SELECT COUNT(*)::int AS n FROM family_links WHERE resident_id=$1`, [link.rows[0].resident_id]);
    if (still.rows[0].n === 0)
      await query(`UPDATE residents SET family_portal_access=FALSE WHERE id=$1`, [link.rows[0].resident_id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// DELETE /family-access/invite/:id
export async function revokeInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    await query(`UPDATE family_invites SET status='revoked' WHERE id=$1 AND care_home_id=$2`, [req.params.id, chId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}
