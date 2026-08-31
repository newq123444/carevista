# DSPT — evidence map

The Data Security and Protection Toolkit requires a "Standards Met" status, and
it is a gate for the NHS Assured Solutions List.

This maps the assertions you will be asked about to the evidence that already
exists in this codebase, so the submission is a matter of pointing at things
rather than writing them from scratch.

| Area | What is asked | Evidence in CareVista |
|---|---|---|
| **Personal data** | You know what personal data you hold and why | DPIA in `compliance/`; the data model is documented by the migrations |
| **Special category data** | Health data is identified and protected | All resident clinical data is treated as special category; access is role-gated server-side |
| **Staff responsibilities** | Staff understand their obligations | Named accounts, no sharing; every clinical write is attributed |
| **Access control** | Access is on a least-privilege basis | `isStaff`, `isClinical`, `isManager`, `isFinance`, `isKitchen`, `isFamily` guards; family users see only their own resident |
| **Audit** | You can show who accessed or changed what | `audit_log` records actor, action, entity, before and after, IP and user agent |
| **Data in transit** | Encrypted | TLS enforced end to end; HSTS via Helmet |
| **Data at rest** | Encrypted | Neon encrypts at rest — **obtain the provider statement for evidence** |
| **Backups** | Backups exist and restore has been tested | **GAP.** Neon provides point-in-time recovery; a restore has never been rehearsed. Do one and record the date and outcome |
| **Business continuity** | There is a plan | **GAP.** Needs writing — a one-page plan is enough at this scale |
| **Incident management** | You can detect, report and respond | Audit log and error logging exist; **the reporting process needs writing down** |
| **Unsupported systems** | None in use | Node 20 LTS, PostgreSQL 15+ |
| **Vulnerability management** | Patching and scanning | CI runs `npm audit`, gitleaks and CodeQL; **enable Dependabot** |
| **Penetration test** | Independent test | **GAP.** Not done |
| **Training** | Annual data security training | **ACTION:** complete the free NHS Data Security Awareness training and keep the certificate |

## The four real gaps

1. **Rehearse a restore.** Take a backup, restore it to a scratch database, confirm the data is intact, write down the date and how long it took. This is the assertion most often failed and the cheapest to fix.
2. **Write a one-page business continuity plan.**
3. **Write down the incident response process** — how you would detect a breach, who you would tell, and within what time (72 hours to the ICO).
4. **Book a penetration test** before real resident data goes in.

Nothing in that list needs code. All four are achievable in a fortnight.
