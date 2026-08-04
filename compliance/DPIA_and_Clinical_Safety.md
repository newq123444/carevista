# CareVista — DPIA, ROPA & Clinical Safety

Three linked artefacts: a Data Protection Impact Assessment (mandatory here), a Record of Processing Activities, and a DCB0129 clinical-safety scaffold for DTAC. Complete `[bracketed]` fields with your specifics.

---

## 1. Data Protection Impact Assessment (DPIA)

**Why required:** large-scale processing of special-category (health) data about vulnerable adults — meets the ICO's mandatory-DPIA triggers.

### 1.1 Describe the processing
- **Data subjects:** care-home residents, their family/next-of-kin, staff.
- **Data types:** identifiers, room/admission, care notes, medications/eMAR, vitals (NEWS2), incidents, risk assessments, wellbeing/mood/sleep, family messages, staff HR/DBS/training, invoices.
- **Special category:** health and care data; potentially religion, ethnicity (care preferences).
- **Flows:** staff enter data via web app → Express API → Postgres. AI operations send *minimised* context to Anthropic and return advisory text (audit-logged).
- **Sub-processors:** `[hosting: Render/Neon/Vercel]`, Anthropic (AI), `[email/SMTP]`, `[S3]`.

### 1.2 Necessity & proportionality
- Each field supports direct care, safety, or regulatory duty (CQC, MCA). Data minimisation applied — AI prompts exclude clinical diagnoses and use limited windows (e.g. 7 days of notes).
- Lawful basis: Art.6(1)(b)/(f); Art.9(2)(h). Retention per POL-06.

### 1.3 Risks & mitigations
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unauthorised cross-tenant access | Low | High | `care_home_id` scoping on every query; pen-test isolation testing |
| Credential compromise | Medium | High | bcrypt, rate limiting, MFA for privileged roles, secret rotation |
| AI over-reliance / incorrect output | Medium | Medium | Advisory-only design, human sign-off, audit log, no diagnoses |
| Data breach in transit/at rest | Low | High | TLS+HSTS, encryption at rest, least privilege |
| Excessive retention | Medium | Medium | Retention & disposal policy (POL-06) |
| Sub-processor exposure | Low | High | DPAs, UK/EU data residency, minimised prompts |

### 1.4 Residual risk & sign-off
Residual risk assessed **`[low]`** after mitigations. Consult DPO. Approved by `[name/role]` on `[date]`. Review on material change.

---

## 2. Record of Processing Activities (ROPA) — summary
| Item | Detail |
|---|---|
| Controller | `[Care home customer]` |
| Processor | CareVista Ltd |
| Purposes | Care delivery, safety, regulatory compliance, wellbeing |
| Categories of data | See 1.1 |
| Recipients / sub-processors | Anthropic, `[hosting]`, `[email]`, `[S3]` |
| Transfers outside UK | `[none / with safeguards]` |
| Retention | Per POL-06 |
| Security measures | RBAC, tenant isolation, encryption, audit logs, TLS/HSTS |

*(A full per-processing-activity ROPA table should be maintained alongside this summary.)*

---

## 3. Data Processing Agreement (DPA) — template clauses
Enter into a UK GDPR Art.28 DPA with each care-home customer, covering: subject-matter & duration; nature & purpose; data types & subjects; controller instructions; confidentiality; security measures (Art.32); sub-processor authorisation & list; assistance with data-subject rights & breach; deletion/return on termination; audit rights; international-transfer safeguards. `[Attach signed DPAs per customer.]`

---

## 4. Intended Use / "Not a Medical Device" statement
**CareVista is a care-management and administrative decision-support tool.** It records care, supports compliance, and provides *advisory* AI assistance (summaries, administrative pattern flags, drafted text). It does **not** diagnose, prescribe, or make autonomous clinical decisions; all AI output requires review and sign-off by a suitably qualified person. It is therefore **not intended to be a medical device** under the UK Medical Devices Regulations 2002.
- Enforced in product: advisory-only system prompt, no diagnostic outputs, mandatory human review, full AI audit trail.
- **Action:** obtain a short written legal/regulatory confirmation of classification referencing current MHRA "software and AI as a medical device" guidance, and keep the intended-use statement version-controlled.

---

## 5. DCB0129 Clinical Safety Case scaffold (for DTAC)
DTAC asks health software to follow **DCB0129** (clinical risk management by the manufacturer).
- **Clinical Safety Officer:** appoint a suitably qualified, registered clinician — `[name, registration]`.
- **Clinical Risk Management System:** documented process for hazard identification, assessment, control, and ongoing monitoring.
- **Hazard Log (start it):**

| ID | Hazard | Cause | Effect | Initial risk | Control | Residual |
|---|---|---|---|---|---|---|
| H-01 | Wrong resident record shown | UI/session mix-up | Care action on wrong person | High | Clear resident context, photo + room on screens, confirm step | `[Low]` |
| H-02 | Missed medication not surfaced | eMAR gap not flagged | Harm from omission | High | Missed-dose report, alerts, nurse review | `[Low]` |
| H-03 | AI summary misleads staff | Over-reliance on AI text | Incorrect care decision | Medium | Advisory-only, human sign-off, no diagnoses | `[Low]` |
| H-04 | Cross-tenant data leak | Access-control flaw | Confidentiality breach | High | Tenant scoping, pen test | `[Low]` |
| H-05 | Data loss | Backup failure | Records unavailable | Medium | Automated backups + restore tests | `[Low]` |

- **Safety case report:** summarise hazards, controls, residual risk, and CSO sign-off. Maintain across releases (DCB0160 covers the deploying organisation).
