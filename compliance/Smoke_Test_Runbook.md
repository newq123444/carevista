# CareVista — Live Smoke Test Runbook

Proves the core journeys work against a real database: health → auth → residents → care notes → incidents → compliance framework, plus security assertions (401 without token, zod range rejection, prototype-pollution guard). Exits non-zero on any failure.

## Option A — GitHub Actions (recommended, fully automated)
`.github/workflows/smoke.yml` runs on every push: it starts a `postgres:16` service, builds, migrates, seeds, boots the API, and runs `tests/smoke.mjs`. No setup — just push and read the check.

## Option B — Docker (one command, local)
```bash
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```
Green run = all smoke checks passed.

## Option C — Against your own database (e.g. Neon)
```bash
cd backend
export DATABASE_URL="postgresql://…"          # your Postgres
export JWT_SECRET="a_32+_char_random_secret_value_here"
export JWT_REFRESH_SECRET="another_32+_char_random_secret"
export NODE_ENV=development
npm ci && npm run build && npm run migrate && npm run seed && npm run seed:ops
node dist/index.js &                          # start API
npm run test:smoke                            # run the journey
```

## What a pass demonstrates
Real DB connectivity, working auth + RBAC, resident/care-note/incident write paths, the new compliance-framework endpoint, and that input validation + the prototype-pollution guard reject bad input — i.e. the app genuinely runs end-to-end, not just compiles.

Default demo login (from seed): `manager@demo.carevista.co.uk` / `Demo1234!`.
