// ============================================================
// src/services/audit.service.ts
// Append-only audit trail — never update or delete
// ============================================================
import { query } from '../models/db';
import { logger } from '../utils/logger';

interface AuditEntry {
  careHomeId: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  beforeData?: object;
  afterData?: object;
  ip?: string;
  userAgent?: string;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (
        care_home_id, actor_id, actor_name, action,
        entity_type, entity_id, before_data, after_data,
        ip_address, user_agent
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.careHomeId, entry.actorId, entry.actorName, entry.action,
        entry.entityType, entry.entityId,
        entry.beforeData ? JSON.stringify(entry.beforeData) : null,
        entry.afterData ? JSON.stringify(entry.afterData) : null,
        entry.ip, entry.userAgent,
      ]
    );
  } catch (err: any) {
    // Audit failures must never crash the main request
    logger.error('Audit log write failed:', err.message);
  }
}
