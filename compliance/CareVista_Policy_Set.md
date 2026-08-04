# CareVista — Information Governance Policy Set

> A consolidated policy manual covering the policies DSPT, Cyber Essentials and enterprise/NHS buyers expect. Replace `[bracketed]` items with your organisation's specifics and have a director sign each off. Review annually.

**Owner:** `[Name, role]`  ·  **Version:** 1.0  ·  **Approved:** `[date]`  ·  **Next review:** `[date + 12 months]`

---

## POL-01 Data Protection Policy
CareVista Ltd processes personal and special-category data under UK GDPR and the Data Protection Act 2018.
- **Roles:** the care home is the **controller**; CareVista is the **processor**. `[DPO / privacy lead name]` owns this policy.
- **Principles:** lawfulness, fairness, transparency; purpose limitation; data minimisation; accuracy; storage limitation; integrity & confidentiality; accountability.
- **Lawful bases:** Art.6(1)(b)/(f); special-category Art.9(2)(h) (health/social care). Recorded in the ROPA.
- **Data subject rights:** access, rectification, erasure, restriction, portability, objection — respond within one month. Route: `[email]`.
- **Breaches:** report to `[privacy lead]` immediately; assess and notify ICO within 72 hours where required (see POL-04).
- **ICO registration:** `[registration number / status]`.

## POL-02 Information Security Policy
- **Objective:** protect confidentiality, integrity and availability of resident and staff data.
- **Technical controls (implemented):** RBAC, tenant isolation, TLS + HSTS, helmet headers, bcrypt hashing, parameterised SQL, rate limiting, input validation, secret-strength boot guard, audit logging.
- **Secure development:** peer review on PRs, CI build + `npm audit` + CodeQL SAST + gitleaks secret scanning, dependency updates within `[30]` days for high/critical.
- **Encryption:** TLS 1.2+ in transit; encryption at rest for DB and file storage.
- **Testing:** annual penetration test; remediate critical/high before go-live and within `[30/90]` days thereafter.

## POL-03 Access Control Policy
- **Least privilege:** access granted by role; every data query scoped to the user's care home.
- **Authentication:** unique accounts, bcrypt passwords, JWT (15-min access + refresh rotation). **MFA required for `[manager/admin]` roles** `[target date]`.
- **Joiners/Movers/Leavers:** access provisioned on start, changed on role change, revoked on the leave date (soft-delete + `active=false`).
- **Reviews:** quarterly access review by `[manager]`; log evidence.
- **No shared accounts.** Demo accounts are disabled in production.

## POL-04 Incident Response Plan
- **Detection:** alerts on auth failures, error spikes, health-check failures; staff report to `[security lead]`.
- **Classification:** severity 1–4; a personal-data breach triggers the GDPR path.
- **Response:** contain → assess → eradicate → recover → review.
- **Notification:** ICO within 72 hours if risk to individuals; affected data subjects without undue delay if high risk; notify affected care-home controllers immediately.
- **Record:** all incidents logged with lessons learned (DSPT standard 5/6).

## POL-05 Business Continuity & Disaster Recovery Plan
- **Backups:** automated daily DB backups, `[30]`-day retention, PITR; quarterly restore test.
- **Targets:** RTO `[4h]`, RPO `[24h]`.
- **Scenarios:** hosting outage (failover/redeploy from IaC), data corruption (restore from backup), key-person loss (documented runbooks), supplier outage (Anthropic/email degrade gracefully — AI already fails safe).
- **Communication:** `[status page / customer comms plan]`.

## POL-06 Data Retention & Disposal Policy
- **Care records:** retain per NHS/social-care records management code (adult social care typically `[8 years]` after last contact / `[3 years]` after death — confirm current guidance).
- **Audit logs:** `[6 years]`.
- **Staff data:** duration of employment + `[6 years]`.
- **Disposal:** secure deletion from DB and backups on expiry; certificate of destruction for any physical media.
- **Data subject erasure:** honoured except where a legal retention duty applies.

## POL-07 Acceptable Use Policy
- Systems and data are for authorised care purposes only.
- No sharing of credentials; lock screens; report suspected phishing.
- No resident data on personal/unencrypted devices or unapproved cloud tools.
- AI outputs are advisory — staff must review before acting; never enter data into unapproved external AI tools.
- Breach of this policy may lead to disciplinary action.

---
### Sign-off
| Policy | Owner | Approved by | Date |
|---|---|---|---|
| POL-01…07 | `[name]` | `[director]` | `[date]` |
