// ============================================================
// src/middleware/validate.ts — zod request validation
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Validates req.body against a zod schema. On failure returns 400 with a
 * structured list of issues. Schemas use .passthrough() so unknown fields are
 * preserved (controllers destructure the fields they need), keeping this
 * backward-compatible with existing clients while enforcing type/range safety
 * on the fields that matter clinically.
 */
export const validateBody = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map(i => ({
          field: i.path.join('.') || '(body)',
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };

// ── Uniform write-body guard ────────────────────────────────────────────────
// Applied to every write request as defence-in-depth, independent of any
// endpoint-specific schema: rejects non-object bodies, prototype-pollution
// keys, excessive nesting, and oversized string fields. This gives baseline
// input validation across all write endpoints (OWASP A03/A08).
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 8;
const MAX_STRING = 50000;

export function guardWriteBody(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const body = (req as any).body;
  // Some writes legitimately carry no body (e.g. action endpoints)
  if (body === undefined || body === null || (typeof body === 'object' && Object.keys(body).length === 0)) {
    return next();
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }
  const walk = (obj: any, depth: number) => {
    if (depth > MAX_DEPTH) throw new Error('Body nesting too deep');
    for (const key of Object.keys(obj)) {
      if (FORBIDDEN_KEYS.has(key)) throw new Error(`Forbidden property name: ${key}`);
      const val = obj[key];
      if (typeof val === 'string' && val.length > MAX_STRING) throw new Error(`Field "${key}" exceeds maximum length`);
      if (val && typeof val === 'object') walk(val, depth + 1);
    }
  };
  try {
    walk(body, 0);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid request body', detail: e.message });
  }
  next();
}


// Accept camelCase or snake_case request-body keys interchangeably. Controllers
// read camelCase; many frontend forms send snake_case. This adds the missing
// alias for every top-level key (additive — never overwrites an existing key),
// eliminating the whole class of field-name mismatches.
const _skip = new Set(['__proto__', 'constructor', 'prototype']);
const _toCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase());
const _toSnake = (k: string) => k.replace(/([A-Z])/g, (m) => '_' + m.toLowerCase());
export function normalizeBody(req: Request, _res: Response, next: NextFunction) {
  const b = req.body;
  if (b && typeof b === 'object' && !Array.isArray(b)) {
    for (const k of Object.keys(b)) {
      if (_skip.has(k)) continue;
      if (k.includes('_')) { const c = _toCamel(k); if (c !== k && !(c in b)) (b as any)[c] = (b as any)[k]; }
      if (/[A-Z]/.test(k)) { const sn = _toSnake(k); if (sn !== k && !(sn in b)) (b as any)[sn] = (b as any)[k]; }
    }
  }
  next();
}
