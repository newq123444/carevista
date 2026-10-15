// ────────────────────────────────────────────────────────────────────────────
// npm run db:check — why can't the server reach the database?
//
// Tests each step separately (address → DNS → port open → SSL + login →
// query) and says which one failed and what usually fixes it. Never prints
// the password.
// ────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';
import dns from 'dns/promises';
import net from 'net';
import { Client } from 'pg';

const ok = (s: string) => console.log(`  ✔ ${s}`);
const bad = (s: string, fix: string) => { console.log(`  ✖ ${s}\n    → ${fix}\n`); process.exit(1); };

async function main() {
  console.log('\nCareVista database check\n');
  const url = process.env.DATABASE_URL;
  if (!url) bad('DATABASE_URL is not set.', 'Add it to backend/.env (copy the connection string from the Neon dashboard).');
  let u: URL;
  try { u = new URL(url!); } catch { return bad('DATABASE_URL is not a valid address.', 'Copy it again from the Neon dashboard; it starts with postgresql://'); }
  const host = u!.hostname, port = Number(u!.port || 5432);
  ok(`Address: ${host}:${port}${u!.pathname}  (user ${decodeURIComponent(u!.username)}, password hidden)`);

  try { const a = await dns.lookup(host); ok(`DNS: ${host} → ${a.address}`); }
  catch (e: any) { bad(`DNS: cannot find ${host} (${e.code}).`, 'Check the internet connection, and that the host name is exactly as in the Neon dashboard. A deleted Neon project also does this.'); }

  await new Promise<void>((resolve) => {
    const s = net.connect({ host, port, timeout: 10_000 });
    s.once('connect', () => { ok(`Port ${port} is reachable from this computer.`); s.destroy(); resolve(); });
    s.once('timeout', () => { s.destroy(); bad(`Port ${port} did not answer within 10 seconds.`, 'This network is probably blocking database connections (common on office, school and public Wi-Fi, and some VPNs). Try a phone hotspot or another network.'); });
    s.once('error', (e: any) => bad(`Port ${port}: ${e.code || e.message}.`, 'Check firewall/antivirus/VPN settings, or try another network.'));
  });

  const c = new Client({ connectionString: url, connectionTimeoutMillis: 20_000, ssl: { rejectUnauthorized: false } });
  try { await c.connect(); ok('SSL and login accepted.'); }
  catch (e: any) {
    const m = String(e.message);
    if (/password|authentication/i.test(m)) bad(`Login refused: ${m}`, 'The password in DATABASE_URL is wrong or was reset. Copy a fresh connection string from Neon.');
    if (/does not exist/i.test(m)) bad(`Database missing: ${m}`, 'The database name at the end of DATABASE_URL does not exist on this server.');
    bad(`Could not log in: ${m}`, 'If this says timeout, the database may be waking from sleep — run this again in 30 seconds.');
  }
  try {
    const { rows } = await c.query('SELECT NOW() AS now, current_database() AS db');
    ok(`Query works. Database "${rows[0].db}", server time ${new Date(rows[0].now).toISOString()}.`);
  } finally { await c.end().catch(() => undefined); }
  console.log('\nThe database is reachable. If the server still fails, run it again and send the first error line.\n');
}
main().catch(e => { console.error(e); process.exit(1); });
