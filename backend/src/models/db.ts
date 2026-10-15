import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // max connections in pool
  idleTimeoutMillis: 30_000,    // close idle connections after 30s
  // Neon (and most hosted Postgres) suspends an idle database and wakes it on
  // the first connection, which can take several seconds. 5s was too short
  // for that first connection; 15s is a safe default and can be changed.
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS) || 15_000,
  ssl: (process.env.NODE_ENV === 'production' || /sslmode=require/.test(process.env.DATABASE_URL || '') || process.env.PGSSL === 'true')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('connect', () => {
  logger.debug('New DB client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected DB pool error:', err);
});

// Helper: run a query against the pool
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow query detected', { text, duration, rows: result.rowCount });
    }
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  } catch (err: any) {
    logger.error('DB query error', { text, params, error: err.message });
    throw err;
  }
}

// Helper: get a dedicated client for transactions
export async function closePool(): Promise<void> {
  await pool.end();
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

// Helper: run a block inside a transaction
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Where we are connecting, without the password. */
export function describeTarget(url = process.env.DATABASE_URL): string {
  if (!url) return '(DATABASE_URL is not set)';
  try { const u = new URL(url); return `${u.hostname}:${u.port || 5432}${u.pathname}`; }
  catch { return '(DATABASE_URL could not be read)'; }
}

// A sleeping database can take a few seconds to wake, and a laptop's network
// can blip. Try a few times before giving up, then say what to check.
export async function testConnection(attempts = 4): Promise<void> {
  const target = describeTarget();
  for (let i = 1; i <= attempts; i++) {
    try {
      const { rows } = await pool.query('SELECT NOW() AS now');
      logger.info('DB connected', { target, serverTime: rows[0].now, attempt: i });
      return;
    } catch (err: any) {
      const last = i === attempts;
      logger.warn(`Database not reachable (attempt ${i} of ${attempts}) at ${target}: ${err.message}`);
      if (last) {
        const hint = /timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(String(err.message) + String(err.code))
          ? '\n  Could not reach the database server. Most likely:' +
            '\n   • this network blocks port 5432 (some office, school and public Wi-Fi do) — try a phone hotspot;' +
            '\n   • DATABASE_URL in backend/.env is out of date — copy it again from the Neon dashboard;' +
            '\n   • the Neon project was deleted or paused.' +
            '\n  Run:  npm run db:check   — it tests each step and says which one fails.'
          : '';
        throw Object.assign(new Error(`${err.message}${hint}`), { cause: err });
      }
      await new Promise(r => setTimeout(r, 2000 * 2 ** (i - 1)));   // 2s, 4s, 8s
    }
  }
}

export default pool;
