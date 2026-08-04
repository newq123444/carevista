// ============================================================
// src/utils/migrate.ts
// Runs migrations/001_init.sql against the configured database.
// Usage: npm run migrate
// ============================================================

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || /sslmode=require/.test(process.env.DATABASE_URL || '') || process.env.PGSSL === 'true')
      ? { rejectUnauthorized: false }
      : false,
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔌 Connected to database.');

    // ── Create migrations tracking table if it doesn't exist ──────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id          SERIAL PRIMARY KEY,
        filename    VARCHAR(255) NOT NULL UNIQUE,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Discover all .sql files in /migrations, sorted ────────────────────
    const migrationsDir = path.resolve(process.cwd(), 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.error(`❌  Migrations directory not found: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('⚠️  No SQL migration files found in /migrations.');
      return;
    }

    // ── Check which migrations have already been applied ──────────────────
    const { rows: applied } = await client.query<{ filename: string }>(
      'SELECT filename FROM _migrations ORDER BY id'
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    let ranCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ⏭  Skipping  ${file}  (already applied)`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`  ▶  Applying  ${file} …`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`  ✅  Applied   ${file}`);
        ranCount++;
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`  ❌  Failed on ${file}:`, err.message);
        throw err;
      }
    }

    if (ranCount === 0) {
      console.log('✅  Database is already up to date — nothing to apply.');
    } else {
      console.log(`\n🎉  Migration complete — ${ranCount} file(s) applied.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});