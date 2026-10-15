// ────────────────────────────────────────────────────────────────────────────
// npm run preflight [-- --db]
//
// Exit code 0: no blockers. Exit code 1: not safe to hold real records.
// Reads the same environment the server would (dotenv), so run it on the
// server, or with the server's environment exported.
// ────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';
import { checkConfig, formatReport } from './preflight';

async function databaseNotes(): Promise<{ notes: string[]; blocked: boolean }> {
  const notes: string[] = [];
  let blocked = false;
  // Imported here so a config-only run never opens a connection.
  const { query, closePool } = await import('../models/db');
  const { migrationStatus } = await import('./migrationStatus');
  try {
    const m = await migrationStatus();
    if (m.unknown) { notes.push(`✖ Could not read migration status: ${m.unknown}`); blocked = true; }
    else if (m.pending.length) {
      notes.push(`✖ ${m.pending.length} migration(s) not applied: ${m.pending.join(', ')}  → npm run migrate`);
      blocked = true;
    } else notes.push(`✔ All ${m.applied} migrations applied.`);

    const { rows: [demo] } = await query(
      `SELECT COUNT(*)::int AS n FROM users
        WHERE lower(email) LIKE '%@demo.carevista.co.uk' AND active = TRUE AND deleted_at IS NULL`);
    if (demo.n > 0) {
      notes.push(`✖ ${demo.n} demo account(s) are still active in this database. → Deactivate them under Staff, or use a fresh database for the pilot.`);
      blocked = true;
    } else notes.push('✔ No active demo accounts.');

    const { rows: [mgr] } = await query(
      `SELECT COUNT(*)::int AS n FROM users
        WHERE role IN ('home_manager','deputy_manager') AND active = TRUE AND deleted_at IS NULL`);
    notes.push(mgr.n > 0 ? `✔ ${mgr.n} active manager account(s).`
                         : '⚠ No active manager account — nobody could change settings or reset passwords.');

    const { rows: [chain] } = await query(
      `SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_record_chain_append_only') AS ok`);
    if (!chain.ok) { notes.push('✖ The record chain\'s append-only trigger is missing. → npm run migrate'); blocked = true; }
    else notes.push('✔ Record chain is append-only in the database.');
  } catch (err: any) {
    notes.push(`✖ Database check failed: ${err?.message || err}`);
    blocked = true;
  } finally {
    await closePool().catch(() => undefined);
  }
  return { notes, blocked };
}

async function main() {
  const withDb = process.argv.includes('--db');
  const result = checkConfig(process.env);
  const db = withDb ? await databaseNotes() : { notes: ['(not checked — add --db)'], blocked: false };
  console.log('\nCareVista pre-pilot check\n' + '─'.repeat(40) + '\n' + formatReport(result, db.notes) + '\n');
  const ok = result.blockers.length === 0 && !db.blocked;
  console.log(ok ? 'Result: PASS — no blockers found. Work through the hand checks too.\n'
                 : 'Result: FAIL — fix the blockers above before any real resident record goes in.\n');
  process.exit(ok ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
