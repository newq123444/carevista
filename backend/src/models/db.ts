import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // max connections in pool
  idleTimeoutMillis: 30_000,    // close idle connections after 30s
  connectionTimeoutMillis: 5_000,
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

export async function testConnection(): Promise<void> {
  const { rows } = await query<{ now: Date }>('SELECT NOW() AS now');
  logger.info('DB connected', { serverTime: rows[0].now });
}

export default pool;
