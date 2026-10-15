// ────────────────────────────────────────────────────────────────────────────
// The phone's clock, for records made offline and sent later.
//
// It is the best evidence of when the care happened, and it is also whatever
// the phone says — which can be wrong or changed. So it is accepted only
// within bounds the database also enforces (migration 038), stored beside the
// server's own time, and always shown as "device time, not verified".
// ────────────────────────────────────────────────────────────────────────────
import { AppError } from './errors';

export const MAX_AHEAD_MS = 5 * 60_000;
export const MAX_BEHIND_MS = 72 * 3600_000;

/** null when not sent; a Date when acceptable; AppError(400) otherwise. */
export function clientRecordedAt(value: unknown, now: Date = new Date()): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new AppError(400, 'clientRecordedAt is not a valid time');
  if (d.getTime() > now.getTime() + MAX_AHEAD_MS) {
    throw new AppError(400, "This phone's clock is ahead of the server. Check the date and time on the phone, then send again.");
  }
  if (d.getTime() < now.getTime() - MAX_BEHIND_MS) {
    throw new AppError(400, 'This was made more than 72 hours ago. Write it as a late entry, saying when the care happened.');
  }
  return d;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function clientRef(value: unknown): string | null {
  return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;
}
