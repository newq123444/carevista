// ============================================================
// src/middleware/errorHandler.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  // PostgreSQL errors
  if ((err as any).code === '23505') {
    return res.status(409).json({ error: 'Duplicate record — this already exists' });
  }
  if ((err as any).code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }
  if ((err as any).code === '23514') {
    return res.status(400).json({ error: 'Value violates a data constraint' });
  }
  if ((err as any).code === '23502') {
    return res.status(400).json({ error: 'A required field is missing' });
  }
  if ((err as any).code === '22P02' || (err as any).code === '22007') {
    return res.status(400).json({ error: 'Invalid value provided for a field' });
  }

  // Missing table or column: the code is ahead of the database because a
  // migration has not been applied. Say exactly that, rather than a bare
  // "relation does not exist" — which tells a manager nothing.
  if ((err as any).code === '42P01' || (err as any).code === '42703') {
    const what = /relation "([^"]+)"/.exec(err.message)?.[1] || /column "([^"]+)"/.exec(err.message)?.[1] || 'part of the database';
    logger.error(`Database is behind the code: ${err.message} — run "npm run migrate" in backend/`, { path: req.path });
    return res.status(503).json({
      error: process.env.NODE_ENV === 'production'
        ? 'This part of CareVista needs a database update that has not been applied yet. Please tell your administrator.'
        : `The database is missing "${what}". A migration has not been applied — run "npm run migrate" in the backend folder, then restart.`,
      code: 'MIGRATION_PENDING',
    });
  }

  logger.error('Unhandled error:', { message: err.message, stack: err.stack, path: req.path });

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
}
