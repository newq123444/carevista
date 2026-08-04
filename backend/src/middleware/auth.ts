import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../models/db';
import { cache } from '../models/redis';
import { AppError } from '../utils/errors';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  care_home_id: string;
  first_name: string;
  last_name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ── Verify JWT access token ───────────────────────────────────────────────
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = req.query?.token as string | undefined;
    if (!authHeader?.startsWith('Bearer ') && !queryToken) {
      throw new AppError(401, 'No token provided');
    }
    const token = queryToken || authHeader!.slice(7);
    let payload: any;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') throw new AppError(401, 'Token expired');
      throw new AppError(401, 'Invalid token');
    }

    // Check if user is blacklisted (e.g. after logout or password change)
    const blacklisted = await cache.get<boolean>(`blacklist:${token}`);
    if (blacklisted) throw new AppError(401, 'Token revoked');

    // Load user from DB (cached 5 min)
    const cacheKey = `user:${payload.sub}`;
    let user = await cache.get<AuthUser>(cacheKey);

    if (!user) {
      const { rows } = await query<AuthUser>(
        `SELECT id, email, role, care_home_id, first_name, last_name
         FROM users WHERE id = $1 AND active = TRUE AND deleted_at IS NULL`,
        [payload.sub]
      );
      if (!rows[0]) throw new AppError(401, 'User not found or deactivated');
      user = rows[0];
      await cache.set(cacheKey, user, 300); // 5 min cache
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// ── RBAC: require one of the given roles ──────────────────────────────────
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Not authenticated'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, `Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

// Shortcut role groups
export const isManager = requireRole('home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin');
export const isClinical = requireRole('registered_nurse', 'senior_carer', 'home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin');
export const isStaff = requireRole('registered_nurse', 'senior_carer', 'carer', 'home_manager', 'deputy_manager', 'activities', 'admin', 'finance', 'super_admin', 'group_admin');
export const isFamily = requireRole('family');
export const isFinance = requireRole('finance', 'home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin');
// Includes operational (non-clinical) staff — cleaning, kitchen, maintenance —
// for shared, non-clinical endpoints (dashboard summary, resident read for
// dietary/room context). Clinical writes/notes remain on the narrower groups.
export const isFacilities = requireRole(
  'home_manager', 'deputy_manager', 'admin', 'super_admin', 'group_admin', 'maintenance'
);
export const isAllStaff = requireRole(
  'registered_nurse', 'senior_carer', 'carer', 'home_manager', 'deputy_manager',
  'activities', 'admin', 'finance', 'super_admin', 'group_admin',
  'cleaning', 'kitchen', 'maintenance'
);

// ── Tenant guard: ensure request is scoped to user's care home ────────────
export function tenantGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Inject care_home_id into query params for downstream use
  if (req.user) {
    (req as any).careHomeId = req.user.care_home_id;
  }
  next();
}
