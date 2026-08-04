# CareVista — DSPT Readiness & Evidence Mapping

The **Data Security & Protection Toolkit (DSPT)** is NHS England's annual self-assessment that health/social-care organisations complete to evidence they meet the National Data Guardian's 10 data security standards. Care providers handling NHS-linked or LA-funded care data are expected to publish "Standards Met." This document maps what CareVista already provides to the standards and lists the organisational gaps you must close (DSPT is assessed at the *organisation* level, so several items are policy/process, not code).

> Status key: ✅ in product · 🟡 partial · ⬜ organisational action needed

## The 10 standards — CareVista position

**1. Personal confidential data** — staff understand their responsibilities.
- ✅ Role-based access control (RBAC) with `isStaff/isClinical/isManager/isFinance` guards; every query scoped by `care_home_id`.
- ⬜ Staff confidentiality clauses + annual data-security training (register template provided).

**2. Staff responsibilities** — appropriate policies in place.
- ⬜ Adopt the policy set in this pack (Data Protection, InfoSec, Access Control, Acceptable Use). See `CareVista_Policy_Set.md`.

**3. Training** — staff complete annual data security awareness.
- ⬜ Track via `Staff_Training_Register.csv`; target ≥95% completion.

**4. Managing access** — access is removed when no longer required.
- ✅ Soft-delete + `active` flags on users; RBAC; JWT with 15-min access tokens + refresh rotation.
- 🟡 Add joiners/movers/leavers process; periodic access reviews (quarterly) — documented in Access Control Policy.
- 🟡 to do Optional MFA for privileged accounts (recommended before go-live).

**5. Process reviews** — learn from incidents/near-misses.
- ✅ `incidents` + `audit_log` capture events.
- ⬜ Adopt Incident Response Plan; log lessons learned.

**6. Responding to incidents** — report within required timeframes.
- ⬜ Incident Response Plan (in policy set) with 72-hour ICO breach process + NHS reporting route.

**7. Continuity planning** — plan for data security incidents.
- ⬜ Business Continuity/DR Plan (in policy set) + backup/restore evidence (see Runbook).

**8. Unsupported systems** — no unsupported software.
- ✅ Node 20, current framework versions.
- ⬜ Dependency-update policy + CI `npm audit` + CodeQL (pipeline provided).

**9. IT protection** — technical controls in place.
- ✅ Helmet security headers + HSTS, parameterised SQL (no injection), bcrypt password hashing, rate limiting, input validation, strict production CORS, boot-time secret strength guard.
- ⬜ Cyber Essentials certification; penetration test (scope provided).

**10. Accountable suppliers** — supply chain meets standards.
- ⬜ Record sub-processors (Anthropic, hosting, email) + their DPAs in the ROPA.

## Evidence you can point to today
Multi-tenant isolation, RBAC, audit logging (`audit_log`, `ai_audit_log`), encrypted transport, password hashing, security headers/HSTS, rate limiting, input validation, advisory-only AI with human sign-off, CI security scanning config.

## Gap list to reach "Standards Met"
1. Publish the policy set and get sign-off.
2. Complete staff data-security training + record it.
3. Achieve Cyber Essentials.
4. Complete the DPIA + ROPA (in this pack).
5. Commission a penetration test; remediate criticals/highs.
6. Document joiners/movers/leavers + quarterly access reviews.
7. Sign DPAs with each care-home customer and with sub-processors.
8. Register with the ICO; appoint a DPO (or record why not required).
