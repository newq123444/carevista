// Tests for the pre-pilot check. The point is that the live demo's settings
// FAIL, and a properly configured pilot server PASSES.
import assert from 'node:assert';
import { randomBytes } from 'node:crypto';
const { checkConfig, secretProblem, KNOWN_WEAK_SECRETS, formatReport } = await import('./preflight.impl.mjs');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); } };
const gen = () => randomBytes(48).toString('base64url');
const good = () => ({
  NODE_ENV: 'production', ENABLE_DEMO_ACCOUNTS: 'false', PILOT_MODE: 'true',
  JWT_SECRET: gen(), JWT_REFRESH_SECRET: gen(),
  CORS_ORIGIN: 'https://app.carevista.example', DATABASE_URL: 'postgresql://u:p@db.example:5432/cv?sslmode=require',
});
const keys = r => r.blockers.map(b => b.key);

t('a properly configured pilot server has no blockers', () => {
  const r = checkConfig(good());
  assert.deepStrictEqual(r.blockers, []);
  assert.deepStrictEqual(r.warnings, []);
});
t('the live demo configuration fails (demo accounts on)', () => {
  assert.ok(keys(checkConfig({ ...good(), ENABLE_DEMO_ACCOUNTS: 'true' })).includes('ENABLE_DEMO_ACCOUNTS'));
  assert.ok(keys(checkConfig({ ...good(), ENABLE_DEMO_ACCOUNTS: 'TRUE' })).includes('ENABLE_DEMO_ACCOUNTS'));
});
t('every secret published in this codebase is refused', () => {
  for (const s of KNOWN_WEAK_SECRETS) assert.ok(secretProblem(s), s);
});
t('short, repetitive and human-typed secrets are refused', () => {
  assert.ok(secretProblem('abc'));
  assert.ok(secretProblem('a'.repeat(64)));
  assert.ok(secretProblem('my_super_secret_key_for_the_care_home_2026!!'));
  assert.ok(secretProblem('carevista-prod-jwt-key-9f8e7d6c5b4a3210zyxw'));
  assert.ok(secretProblem(undefined));
});
t('generated secrets are accepted, 2,000 times over (no false alarms from chance words)', () => {
  for (let i = 0; i < 2000; i++) { const s = gen(); assert.strictEqual(secretProblem(s), null, s); }
});
t('the two JWT secrets must differ', () => {
  const s = gen();
  assert.ok(keys(checkConfig({ ...good(), JWT_SECRET: s, JWT_REFRESH_SECRET: s })).includes('JWT_REFRESH_SECRET'));
});
t('development mode is a blocker', () => {
  assert.ok(keys(checkConfig({ ...good(), NODE_ENV: 'development' })).includes('NODE_ENV'));
  assert.ok(keys(checkConfig({ ...good(), NODE_ENV: undefined })).includes('NODE_ENV'));
});
t('CORS: empty, wildcard and plain http are blockers; localhost is a warning', () => {
  assert.ok(keys(checkConfig({ ...good(), CORS_ORIGIN: '' })).includes('CORS_ORIGIN'));
  assert.ok(keys(checkConfig({ ...good(), CORS_ORIGIN: '*' })).includes('CORS_ORIGIN'));
  assert.ok(keys(checkConfig({ ...good(), CORS_ORIGIN: 'http://carevista.example' })).includes('CORS_ORIGIN'));
  const r = checkConfig({ ...good(), CORS_ORIGIN: 'https://a.example, http://localhost:5173' });
  assert.deepStrictEqual(keys(r), []);
  assert.ok(r.warnings.some(w => w.key === 'CORS_ORIGIN'));
});
t('database: missing is a blocker, unencrypted remote is a warning', () => {
  assert.ok(keys(checkConfig({ ...good(), DATABASE_URL: '' })).includes('DATABASE_URL'));
  const r = checkConfig({ ...good(), DATABASE_URL: 'postgresql://u:p@db.example:5432/cv' });
  assert.ok(r.warnings.some(w => w.key === 'DATABASE_URL'));
  assert.ok(!checkConfig({ ...good(), DATABASE_URL: 'postgresql://u:p@localhost:5432/cv' }).warnings.some(w => w.key === 'DATABASE_URL'));
});
t('weak password hashing is a blocker', () => {
  assert.ok(keys(checkConfig({ ...good(), BCRYPT_ROUNDS: '4' })).includes('BCRYPT_ROUNDS'));
});
t('AI configured is a warning about data leaving the service', () => {
  assert.ok(checkConfig({ ...good(), ANTHROPIC_API_KEY: 'x' }).warnings.some(w => w.key === 'ANTHROPIC_API_KEY'));
});
t('the report never prints a secret', () => {
  const env = { ...good(), JWT_SECRET: 'replace_with_a_long_random_secret_min_32_chars' };
  const s = formatReport(checkConfig(env));
  assert.ok(!s.includes(env.JWT_SECRET), 'secret value appeared in the report');
  assert.ok(!s.includes(env.JWT_REFRESH_SECRET));
});

console.log(`\npreflight: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
