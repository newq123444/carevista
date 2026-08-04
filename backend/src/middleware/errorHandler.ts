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

  logger.error('Unhandled error:', { message: err.message, stack: err.stack, path: req.path });

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
}
