# CareVista — Certification Readiness Pack

This folder is the evidence base to get CareVista to a **fully audited, penetration-tested, DSPT-certified production deployment**. It contains everything I can produce; the three items that require external parties are marked ⧉.

## Contents
- `DSPT_Readiness_and_Evidence.md` — mapping to the 10 NHS data-security standards + gap list.
- `CareVista_Policy_Set.md` — the 7 governance policies (POL-01…07).
- `Security_Review_and_PenTest_Scope.md` — internal OWASP review + the scope you hand an accredited tester.
- `DPIA_and_Clinical_Safety.md` — DPIA, ROPA, DPA clauses, "not a medical device" statement, DCB0129 hazard log.
- `Deployment_Runbook.md` — secure production deployment + backup/DR + go-live checklist.
- `Smoke_Test_Runbook.md` — prove the app runs end-to-end against a real database (CI + Docker + manual).
- `Staff_Training_Register.csv` — DSPT training evidence template.
- `../.github/workflows/ci.yml` — CI with build, `npm audit`, gitleaks, CodeQL.

## Sequenced roadmap to certified production

**Phase 1 — Remediate & document (weeks 1–2)**
1. ⚠️ Rotate the exposed secrets from the old `.env`.
2. Adopt & sign the policy set; register with ICO; appoint DPO + Clinical Safety Officer.
3. Complete the DPIA + ROPA with your specifics.
4. Enable MFA for privileged roles; extend zod validation to all write endpoints.

**Phase 2 — Infra & controls (weeks 2–4)**
5. Stand up staging = production config; DB encryption + automated backups + restore test.
6. Wire the CI pipeline; triage first `npm audit`/CodeQL results.
7. Achieve **Cyber Essentials** (fast, cheap, expected).

**Phase 3 — External validation (weeks 4–8)** ⧉
8. Commission a **CREST/CHECK penetration test** against staging using the provided scope; remediate criticals/highs.
9. Complete and publish the **DSPT** self-assessment ("Standards Met").
10. Complete **DTAC** (uses the DPIA, clinical safety case, security evidence here).
11. If enterprise/group buyers require it, begin **ISO 27001**.

**Phase 4 — Go-live**
12. Run the Deployment Runbook go-live checklist; deploy to production with real data only after Phases 1–3 pass.

⧉ = must be performed/issued by an external accredited party (pen-test firm, NHS England DSPT, your auditor). I've prepared everything they need; I cannot issue the certificate itself.
