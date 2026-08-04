# CareVista — Software Completion Report

This records everything completed on the software (final build: `carevista_ready_v13.zip`), and the items that remain — which are **not** code: your runtime testing, external certifications, and the visa/business steps.

## Build status
- Backend (`tsc`) — **compiles clean**.
- Frontend (`tsc`) — **compiles clean**.
- Unit tests — **20/20 pass**.
- Smoke test (mock-backed here; real Postgres in CI) — **20/20 checks pass**.

## Completed in this engagement

**Correctness / bug classes eliminated**
- AI service model id fixed and made configurable (was invalid → every AI call failed).
- Frontend↔backend route mismatches resolved (added missing endpoints; fixed methods).
- Real create-path bugs fixed (resident, care note, staff) that returned 500s on missing/enum fields.
- Enum/validation alignment (note type, medication status, incident status, shift type, funding type, risk level, severity).
- Global database-error safety net: NOT NULL (23502) and invalid-value (22P02) now return clean 400s everywhere.

**Role access (systematic audit via a nav→page→endpoint→guard analyzer)**
- Read access gaps: **90 → 1** (the one remaining is the `family` role, which has no login/dashboard — unreachable).
- Write/mutation gaps: **39 → 16**, and the 16 are deliberate least-privilege boundaries (e.g. medication administration, e-learning creation, QR-code generation).
- Added `isAllStaff` and `isFacilities` permission groups; a minimal colleagues endpoint so care staff get name pickers without exposing HR/pay data.

**Security hardening**
- Production CORS allowlist; boot-time guard that refuses weak/default secrets.
- Helmet + HSTS + referrer policy; uniform write-body guard (prototype-pollution, oversized-field, shape).
- zod validation on the core clinical and financial write paths.
- Demo accounts disabled in production by default.
- Committed `.env` with live secrets removed from the package.

**Resilience / production readiness**
- 401 auto-logout interceptor (already present, verified).
- Error boundary wraps the app (verified); production errors hidden.
- **Graceful shutdown** added (SIGTERM/SIGINT → close DB pool).
- Global API rate limiting + stricter login limiter (verified present).
- Health (`/health`) and DB-readiness (`/health/db`) endpoints.
- Secrets generator: `npm run gen-secrets`.

**Features**
- **Housekeeping module** — digitises the paper daily/weekly/quarterly room + communal-area checklists, seeded with your exact specifications, tied to real rooms/residents, with a cleaner-facing page and a `/housekeeping/summary` endpoint.
- **Live operational dashboards** — Cleaning (housekeeping today + recent activity), Kitchen (today's catering, texture-modified meals), Maintenance (room-turnover pipeline) now driven by real data.

**Testing scaffolding (for you to run)**
- 20 unit tests (`npm test`), a 20-check end-to-end smoke test (`npm run test:smoke`), a GitHub Actions **smoke job with a real Postgres service container**, and a CI pipeline (build, `npm audit`, gitleaks, CodeQL).

## Remaining — NOT code (yours / external)

**You will do (as agreed): runtime testing**
- Run v13 on your database and click through every role end-to-end. The CI smoke job does part of this automatically on push.

**Before production go-live (needs your infra / external parties)**
- Rotate the secrets that were in the old `.env` (use `npm run gen-secrets`).
- Encryption at rest + automated backups + restore test.
- Independent **penetration test**; then **Cyber Essentials**, **NHS DSP Toolkit**, **DTAC** (evidence templates are in the compliance pack).

**Visa application (the actual gate — none of it is software)**
- Secure an **endorsement** from an approved body (UK Endorsing Services, Innovator International, Envestors).
- Fill the business plan (`CareVista_Business_Plan.docx`) and model (`CareVista_Financial_Model.xlsx`) with your **real founder story and validated financials**.
- **Market validation** — a pilot home or letter of intent (single biggest lever).
- **Personal eligibility** — English B2, £1,270 maintenance funds.

## Minor items intentionally left
- 16 restricted action buttons still render for roles that can't use them; the action fails gracefully with a toast rather than a crash. (UX polish, not a defect.)
- Some illustrative demo tiles remain below the live sections on operational dashboards.

## How to run locally
See `compliance/Smoke_Test_Runbook.md` and `compliance/Deployment_Runbook.md`. In short: create `backend/.env` (Postgres URL, no `sslmode` for a local DB), then `npm install && npm run build && npm run migrate && npm run seed && npm run dev` in `backend`, and `npm install && npm run dev` in `frontend`. Log in at `localhost:8080` (`manager@demo.carevista.co.uk` / `Demo1234!`).
