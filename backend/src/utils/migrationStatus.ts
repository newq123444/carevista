// ────────────────────────────────────────────────────────────────────────────
// Which migration files exist on disk but have not been applied.
//
// Every release that adds a table shipped with a migration, and nothing ever
// applied them on deploy — so new code met an old schema and failed with
// "relation … does not exist". This makes that state visible the moment the
// server starts, and on /health/migrations, instead of when a manager opens a
// screen.
// ────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { query } from '../models/db';

export function migrationsDir(): string {
  return path.resolve(process.cwd(), 'migrations');
}

export function migrationFiles(): string[] | null {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
}

export interface MigrationStatus {
  total: number;
  applied: number;
  pending: string[];
  /** Set when the status could not be worked out — never treated as "all fine". */
  unknown?: string;
}

export async function migrationStatus(): Promise<MigrationStatus> {
  const files = migrationFiles();
  if (!files) return { total: 0, applied: 0, pending: [], unknown: `No migrations folder at ${migrationsDir()}` };
  try {
    const { rows } = await query<{ filename: string }>('SELECT filename FROM _migrations');
    const done = new Set(rows.map(r => r.filename));
    return { total: files.length, applied: files.filter(f => done.has(f)).length, pending: files.filter(f => !done.has(f)) };
  } catch (err: any) {
    // No tracking table at all: nothing has ever been applied.
    if (err?.code === '42P01') return { total: files.length, applied: 0, pending: files };
    return { total: files.length, applied: 0, pending: [], unknown: err?.message || 'Could not read _migrations' };
  }
}
