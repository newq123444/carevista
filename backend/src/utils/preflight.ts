// ────────────────────────────────────────────────────────────────────────────
// Pre-pilot checks: is this server safe to hold real residents' records?
//
// The live demo deliberately runs with demo accounts on and a published
// password. That is fine for a demo and a data breach for a pilot. This is
// the line between the two, written down so it cannot be forgotten:
//
//   npm run preflight          configuration only
//   npm run preflight -- --db  also checks the database (migrations, demo users)
//
// Set PILOT_MODE=true on a server that holds real records and it will refuse
// to start while any blocker below is present.
//
// Pure: no database, no imports with side effects, so it is unit-tested.
// ────────────────────────────────────────────────────────────────────────────

export interface Finding { key: string; message: string; fix: string }
export interface PreflightResult { blockers: Finding[]; warnings: Finding[]; manual: string[] }

// Values that have appeared in this repository's examples, CI and old
// defaults. A secret that has ever been written down here is not a secret.
export const KNOWN_WEAK_SECRETS = [
  'change_this_in_production_minimum_32_chars',
  'change_this_refresh_secret_32chars',
  'replace_with_a_long_random_secret_min_32_chars',
  'replace_with_a_different_long_random_secret_32',
  'ci_test_jwt_secret_at_least_32_characters_long',
  'ci_test_refresh_secret_at_least_32_characters',
];

// Whole words between separators, so a random string that happens to contain
// "dev" somewhere is not flagged.
const HUMAN_WORDS = /(^|[_\-\s.])(change|replace|example|secret|password|default|carevista|test|demo|dev|prod)(?=[_\-\s.]|$)/i;
const GEN = 'Generate one with:  npm run gen-secrets   (or: openssl rand -base64 48)';

export function secretProblem(value: string | undefined): string | null {
  if (!value) return 'is not set';
  if (KNOWN_WEAK_SECRETS.includes(value)) return 'is a value published in this codebase';
  if (value.length < 32) return `is ${value.length} characters; it must be at least 32`;
  if (new Set(value).size < 12) return 'has too little variety to be random';
  if (HUMAN_WORDS.test(value)) return 'looks typed by a person rather than generated';
  return null;
}

function isLocalHost(url: string): boolean {
  return /\/\/([^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url);
}

export function checkConfig(env: Record<string, string | undefined>): PreflightResult {
  const blockers: Finding[] = [];
  const warnings: Finding[] = [];
  const block = (key: string, message: string, fix: string) => blockers.push({ key, message, fix });
  const warn  = (key: string, message: string, fix: string) => warnings.push({ key, message, fix });

  if (env.NODE_ENV !== 'production') {
    block('NODE_ENV', `NODE_ENV is "${env.NODE_ENV || '(unset)'}", not "production"`, 'Set NODE_ENV=production.');
  }

  if (String(env.ENABLE_DEMO_ACCOUNTS).toLowerCase() === 'true') {
    block('ENABLE_DEMO_ACCOUNTS',
      'Demo accounts are switched on. Their password is published, so anyone can sign in as a manager.',
      'Set ENABLE_DEMO_ACCOUNTS=false, then create real accounts for each member of staff.');
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const p = secretProblem(env[key]);
    if (p) block(key, `${key} ${p}.`, GEN);
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    block('JWT_REFRESH_SECRET', 'JWT_SECRET and JWT_REFRESH_SECRET are the same.', GEN);
  }

  const origins = String(env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origins.length === 0) {
    block('CORS_ORIGIN', 'CORS_ORIGIN is empty.', 'List the frontend address, e.g. https://carevista.example.co.uk');
  } else {
    if (origins.some(o => o === '*' || o.includes('*'))) {
      block('CORS_ORIGIN', 'CORS_ORIGIN allows any website.', 'List only your own frontend addresses.');
    }
    const plain = origins.filter(o => o.startsWith('http://') && !isLocalHost(o));
    if (plain.length) block('CORS_ORIGIN', `Not encrypted (http://): ${plain.join(', ')}`, 'Use https:// addresses only.');
    const local = origins.filter(o => isLocalHost(o));
    if (local.length) warn('CORS_ORIGIN', `Allows a local development address: ${local.join(', ')}`, 'Remove localhost from CORS_ORIGIN on the live server.');
  }

  const db = env.DATABASE_URL || '';
  if (!db) {
    block('DATABASE_URL', 'DATABASE_URL is not set.', 'Set it to the pilot database.');
  } else if (!isLocalHost(db) && !/sslmode=(require|verify-ca|verify-full)/i.test(db) && String(env.PGSSL).toLowerCase() !== 'true') {
    warn('DATABASE_URL', 'The database address does not ask for an encrypted connection.', 'Add ?sslmode=require to DATABASE_URL.');
  }

  const rounds = Number(env.BCRYPT_ROUNDS || 12);
  if (!Number.isFinite(rounds) || rounds < 10) {
    block('BCRYPT_ROUNDS', `BCRYPT_ROUNDS is ${env.BCRYPT_ROUNDS}; passwords would be too quick to guess.`, 'Use 12 (the default).');
  }

  if (env.ANTHROPIC_API_KEY) {
    warn('ANTHROPIC_API_KEY',
      'AI features are configured. When used, they send resident information to an outside processor.',
      'Make sure your DPIA and the home\'s contract cover it, or leave ANTHROPIC_API_KEY empty for the pilot.');
  }

  if (String(env.PILOT_MODE).toLowerCase() !== 'true') {
    warn('PILOT_MODE', 'PILOT_MODE is not on, so the server will start even if a blocker above is present.',
      'Set PILOT_MODE=true on the server that holds real records.');
  }

  return {
    blockers, warnings,
    manual: [
      'Secrets from any .env file that was ever committed or shared have been replaced (JWT secrets, database password, API keys).',
      'The pilot database is not the one used for local development or the public demo.',
      'Each member of staff has their own account; nobody shares a login.',
      'Backups of the pilot database are switched on and one restore has been tried.',
      'The home has a signed data processing agreement and a DPIA for the pilot.',
    ],
  };
}

export function formatReport(r: PreflightResult, dbNotes: string[] = []): string {
  const out: string[] = [];
  if (r.blockers.length === 0) out.push('✔ No blockers.');
  else {
    out.push(`✖ ${r.blockers.length} blocker(s) — not safe for real records:`);
    for (const b of r.blockers) out.push(`   • ${b.message}\n     → ${b.fix}`);
  }
  if (r.warnings.length) {
    out.push('', `⚠ ${r.warnings.length} warning(s):`);
    for (const w of r.warnings) out.push(`   • ${w.message}\n     → ${w.fix}`);
  }
  if (dbNotes.length) out.push('', 'Database:', ...dbNotes.map(n => `   ${n}`));
  out.push('', 'Check by hand (this script cannot see these):', ...r.manual.map(m => `   □ ${m}`));
  return out.join('\n');
}
