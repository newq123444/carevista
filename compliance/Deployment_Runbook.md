# CareVista — Production Deployment Runbook

Target: a secure, reproducible production deployment. The app is already containerised (multi-stage Dockerfiles, non-root user, healthchecks). This runbook covers the surrounding controls a pen tester / DSPT / DTAC reviewer will expect.

## 1. Environments
| Env | Purpose | Data |
|---|---|---|
| dev | local Docker Compose | synthetic only |
| staging | pre-prod, identical config | synthetic only |
| production | live | real resident data — access controlled |

Never load real resident data into dev/staging. Demo accounts (`@demo.carevista.co.uk`) are blocked in production by default (`ENABLE_DEMO_ACCOUNTS` guard).

## 2. Secrets management
- Store secrets in the platform secret manager (Render/Vercel env, AWS Secrets Manager) — never in the repo. `.env` is git-ignored.
- **Rotate the credentials that were exposed in the old committed `.env`** (Anthropic, AWS, DB, JWT, SMTP) before go-live.
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: ≥32 random chars, different from each other. The server refuses to boot in production otherwise.
- `CORS_ORIGIN`: exact production frontend origin(s), comma-separated.

## 3. Transport security
- TLS everywhere (Render/Vercel terminate TLS automatically; if self-hosting, use a reverse proxy with Let's Encrypt).
- HSTS is enabled in production (1 year, includeSubDomains, preload) via helmet.
- Force HTTP→HTTPS redirects at the edge.

## 4. Data at rest
- Managed Postgres with encryption at rest (Neon/RDS provide this) and TLS in transit (`sslmode=require`).
- Uploads: move from local disk to encrypted S3 (`AWS_*` env already wired). Local disk on Render is ephemeral — do not rely on it.

## 5. Backups & DR
- Automated daily DB backups, 30-day retention, point-in-time recovery enabled.
- Documented RTO/RPO targets (suggest RTO 4h, RPO 24h; tighten as you scale).
- Quarterly restore test — log evidence for DSPT.

## 6. Observability & audit
- Centralised logs (structured winston output) shipped to a log service; retain ≥6 months.
- The `audit_log` and `ai_audit_log` tables capture user and AI actions — expose an admin view and set a retention policy.
- Alerting on error rate, auth failures, and health-check failures.

## 7. CI/CD gates (see .github/workflows/ci.yml)
- Build + typecheck both packages.
- `npm audit` (high) — triage advisories.
- Secret scanning (gitleaks) and CodeQL SAST on every PR.
- Require green checks + review before merge to main.

## 8. Go-live checklist
- [ ] Secrets rotated and stored in secret manager
- [ ] Production `JWT_*` ≥32 chars; `CORS_ORIGIN` set
- [ ] Demo accounts disabled (default)
- [ ] TLS + HSTS verified (SSL Labs A)
- [ ] DB encryption + automated backups on; restore tested
- [ ] Uploads on encrypted S3
- [ ] Pen test passed and criticals/highs remediated
- [ ] DPIA signed; DSPT "Standards Met"; DPAs signed with customers
- [ ] Rollback plan documented
