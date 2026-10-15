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

/** Where we are connected, without the password — so nobody has to guess which database got migrated. */
function describeTarget(url: string | undefined): string {
  if (!url) return '(DATABASE_URL is not set)';
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch { return '(DATABASE_URL could not be read)'; }
}

/** Turn Postgres's character offset into a line number in the file. */
function lineOf(sql: string, position: unknown): number | null {
  const p = Number(position);
  if (!Number.isFinite(p) || p <= 0) return null;
  return sql.slice(0, p).split('\n').length;
}

const STATUS_ONLY = process.argv.includes('--status');

async function migrate() {
  const client = await pool.connect();

  try {
    console.log(`🔌 Connected to database: ${describeTarget(process.env.DATABASE_URL)}`);

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
    const pending = files.filter(f => !appliedSet.has(f));

    console.log(`   ${files.length - pending.length} of ${files.length} migrations already applied.`);
    if (pending.length) {
      console.log(`   To apply (${pending.length}):`);
      for (const f of pending) console.log(`     • ${f}`);
    }
    if (STATUS_ONLY) {
      console.log(pending.length ? '\nRun "npm run migrate" to apply them.' : '\n✅  Up to date.');
      return;
    }

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
        const line = lineOf(sql, err.position);
        console.error(`\n  ❌  Failed on ${file}${line ? ` at line ${line}` : ''}:`);
        console.error(`      ${err.message}`);
        if (err.detail) console.error(`      Detail: ${err.detail}`);
        if (err.hint)   console.error(`      Hint:   ${err.hint}`);
        if (err.where)  console.error(`      Where:  ${err.where}`);
        if (line) {
          const lines = sql.split('\n');
          console.error(`      > ${lines[line - 1]?.trim()}`);
        }
        // Nothing in this file was applied (it ran in a transaction), and the
        // files after it were not attempted. Say so, so nobody assumes the
        // later tables exist.
        const notApplied = pending.slice(pending.indexOf(file));
        console.error(`\n      Not applied: ${notApplied.join(', ')}`);
        console.error('      Fix the error above and run "npm run migrate" again — applied files are skipped.\n');
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