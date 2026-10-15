# CareVista v88 — assessments and care plans in depth

You asked for detailed care plans and detailed risk assessments, done fully. This release does three things:

- It replaces the old automatic risk scores with nine proper clinical assessments, each answered by a person.
- It turns each assessment into exact care plan content that a nurse chooses to accept.
- It puts the few facts that must never be missed in front of carers before they help someone.

**First, a fix you need.** The v87 package had a broken `frontend/src/pages/ResidentDetail.tsx`. An edit in v87 cut off the resident page's main component, so **the v87 frontend would not have built on Vercel**. v88 restores it from v86c and re-applies the v87 changes. A new check now stops this from happening again: `check-default-exports` confirms that every page the app loads actually exports itself. If you deployed v87 and saw a failed build, this was the cause.

**Database:** one new migration, `040_assessments_in_depth.sql`. Render applies it on start. Locally, run `cd backend && npm run migrate`.

---

## 1. Nine assessments, answered by a person

The old Waterlow, MUST and falls scores were filled in automatically from whatever the record happened to hold. Falls also produced a risk score, which NICE now advises against. All three are gone. Their old results are kept, clearly marked "older automatic score — redo by hand".

| Tool | What it decides | Based on |
|---|---|---|
| **Waterlow** | Pressure ulcer risk: 10+ at risk, 15+ high, 20+ very high. Then repositioning every 6 or 4 hours, the mattress and cushion, and heel offloading. | Waterlow 2005 card; NICE CG179 |
| **MUST** | Malnutrition risk, using the three steps (BMI, weight loss, acute illness). Then the BAPEN care-home actions: observe, treat, or routine care. | BAPEN |
| **Falls** | A multifactorial assessment of 12 factors, each with actions. **There is no score**, on purpose. | NICE NG249 (2025) |
| **Moving and handling** | Task by task (bed, transfers, walking, toilet, bath, from the floor): carers, equipment, hoist, sling type, size and loops. | HSE; LOLER |
| **Eating, drinking and choking** | Swallowing warning signs, IDDSI food and drink levels, choking risks, help at meals, and when to refer to SALT. | IDDSI; NHS |
| **Oral health** | The 8-area OHAT mouth check, help with brushing, dentures, and the dentist. Includes the referral rules. | OHAT; NICE NG48 |
| **Bed rails** | Whether to use rails, the alternatives, consent, entrapment risk, and five safety checks that must all be confirmed. | MHRA; NHS Never Events |
| **PEEP** | Fire evacuation: Green, Amber or Red, staff by day and by night, equipment, and route. | Fire and rescue RPEEP templates |
| **Abbey pain** | As in v87, now inside the same engine. | Abbey 2004 |

**How each one works for the nurse**

- **One step at a time.** The result builds as the nurse answers: the score, band, reasons, what to do, and any warnings.
- **The record fills in what it knows.** Age, sex, latest weight, height, the weight from 3–6 months ago, room and current medicines are suggested and marked *"From the record — check it"*. The nurse confirms each one.
- **"Start from the last assessment"** for reviews, with a reminder to check every answer.
- **It refuses to save if:**
  - any question is unanswered;
  - answers contradict each other or leave something unsafe (for example rails without every safety check, a hoist without a sling size, or walking planned for someone who cannot bear weight);
  - the nurse has not said **how the person was involved** (CQC Regulation 9).
- **Warnings appear but don't block saving.** Examples:
  - one carer on a full hoist;
  - a standing aid for someone who cannot bear weight;
  - lifting from the floor by hand;
  - a capacity issue with bed rails;
  - two or more falls in a year;
  - oxygen in a PEEP;
  - more help needed at night than by day.

**How each one is stored**

- **The server scores it again** with its own copy of the tool and stores that result. A tampered or out-of-date phone cannot change a score.
- **It is final once saved**, enforced by the database. A reassessment replaces it, and both stay on the record. Only one assessment of each kind can be "current" per person.
- **It is sealed on the record chain**, covering both the answers and the advice given. The tool version is stored with it.
- **Review dates come from the tool**, for example weekly while Waterlow is high and monthly when not.

> **The rules for the app and the server live in one file:** `backend/src/services/assessmentTools.ts`. The app's copy is generated from it by `node scripts/sync-shared.mjs`, and the build fails if the two differ.

## 2. From assessment to care plan, with the nurse choosing

After saving, the nurse sees **"Add to their care plan"** and ticks what goes in:

- **What they need**, in plain words with the reasons.
- **How to support them**, chosen action by action.
- **Equipment**, staff numbers and the risk level for that need.
- **Key details** (see below).
- **Times on their day.** For example, *02:00, 06:00 … 22:00 — change position and check pressure areas*, or *21:00 — check bed rails, bumpers and gaps*. Each time becomes a task on the round, as in v87. Times are unticked by default, so nobody gets woken at 2am by accident.

Text is added below what a person has already written and never overwrites it. Duplicate times are skipped. A signed plan that changes goes back to "needs re-signing".

## 3. Care plans in depth

- **Key details for each need.** Some things must be exact, not prose, so each area of care now has proper fields. Examples:
  - IDDSI food and drink levels
  - sling type, size and loops
  - how often to change position, and the mattress
  - continence products and catheter
  - glasses and hearing aids
  - bed rails, or what is used instead
  - PEEP category
  - ReSPECT form
  - The server validates these fields.
- **Every current assessment shows on its need**, with buttons for *Assess* or *Reassess*. Overdue and older automatic scores are flagged.
- **"Is it working?"** A nurse records an evaluation for each need: better, no change, worse or goal met, what they saw, and whether the plan is still right. "Plan needs changing" marks the need. Evaluations cannot be edited or deleted. This is the monthly evaluation evidence inspectors ask for.
- **Print full plan.** A proper paper version for the family, a hospital transfer or the file:
  - about me
  - know before you help
  - their day
  - every need with its details, support, evaluations and assessments
  - areas that don't apply, with the reason
  - a current-assessments table
  - signature lines

## 4. "Know before you help" for carers

There is now a short red-and-amber list of facts. Examples:

- *Allergies: penicillin*
- *Food: Level 5 — Minced & moist*
- *Transfers: full hoist, 2 carers*
- *Sling: size M (green loops)*
- *Change position every 4 hours*
- *Fire (PEEP): RED*

Where it appears:

- on the resident's page;
- on **Record care**;
- on the round's card (red and amber only, at most three).

The facts come **only from the care plan's details**, so they can never contradict the plan a nurse signed. Before a person has a plan, the list comes from their assessments and says so. The labels are translated into all five languages. The facts themselves stay in English, like every record.

## 5. For the manager

- **Assessments register** (menu → Assessments): every resident against every tool, in colour.
  - It shows overdue, due this week, never done, and older automatic scores, with filters.
  - Tap a cell to open that assessment or start a new one.
- **Fire grab sheet**: every resident's PEEP on one printable page, by floor.
  - It shows category, staff by day and night, equipment, how to alert them, and the route.
  - Residents with no PEEP are listed first.
  - Anyone in hospital is marked "AWAY — not in building".
- **The demo data** now holds realistic assessments made by the same engine, instead of random numbers.

---

## Checks

`npm run check` passes: 15 guards and 440 unit tests (the 6 old Abbey-only tests moved into the engine's tests).

New guards:

- **shared modules in step** — the app's copy of the tools matches the server's;
- **default exports** — the guard that would have caught the v87 break.

New tests:

- **53 for the assessment engine.** They cover every band edge for Waterlow (9/10/14/15/19/20), MUST, OHAT, Abbey and PEEP. They also cover:
  - falls having no score;
  - each safety refusal and warning;
  - junk answers;
  - suggestions from the record.
- **11 for care plan details and facts.** These include a check that every tool's suggested details are valid for its care plan area.

**Database tests in CI:**

- **Integrity tests (rolled back).** They try to edit, delete or un-supersede a completed assessment. They also try to create two "current" assessments and to save one without answers or an assessor. They try to edit or delete an evaluation, and check that deleting a whole plan still cascades.
- **Endpoint tests.** They run against the throwaway CI database only (`CV_ALLOW_TEST_WRITES=1` with a localhost host). They:
  - save a Waterlow and check the server's score (19, high, 4-hourly);
  - reassess and check it supersedes the first;
  - save a falls assessment with no score;
  - apply it to the plan, then check the facts and add an evaluation.
  - They also check the register, the fire grab sheet and the context endpoint.

## What I could not check — please do these

- **No browser or database here.** The runner's phone and desktop layout was checked as an HTML prototype (`v88_prototype.html`), using the real stylesheet. The React screens have not been seen running. After deploying, try one of each assessment on a phone. Then open the register, the fire grab sheet and **Print full plan**.
- **Migration 040 and the new SQL** run in CI on your next push. Check that "Smoke (E2E)" is green.
- **A nurse must check the clinical content before any pilot.** The wording, the actions and the review intervals are mine, built from the sources below.
  - **Waterlow:** the bands are standard, but local versions of the card differ. The neurological 4–6 and surgery items need clinical judgement.
  - **MUST:** this follows BAPEN. High-risk residents are reviewed weekly here, while BAPEN says to review the care plan monthly in care homes. Set it to your policy.
  - **Choking, bed rails, moving and handling and PEEP** use clear rules, not validated scores. Each reason is shown.
  - **PEEP Green** is a common care-home convention. Fire service templates define Red and Amber only.
- **Predictive Care** (`/predictive`) still shows a weighted falls "score" built from records. That screen is framed as reference information, but in the light of NICE NG249 you may want to remove or relabel it before a pilot.
- **Translations:** 74 new phrases in each language are AI drafts. Ask a native speaker to check them, as before.

## Sources

- [NICE NG249 — Falls: assessment and prevention in older people and people 50 and over at higher risk (2025)](https://www.nice.org.uk/guidance/ng249)
- [NICE CG179 — Pressure ulcers: prevention and management](https://www.nice.org.uk/guidance/cg179)
- [Waterlow score — overview, criteria and reliability](https://en.wikipedia.org/wiki/Waterlow_score); [MetricGate Waterlow calculator](https://metricgate.com/docs/waterlow-pressure-ulcer/); [Waterlow manual](https://hauoratairawhiti.org.nz/assets/Uploads/Waterlow-Manual.pdf)
- [BAPEN — MUST toolkit](https://www.bapen.org.uk/must-and-self-screening/must-toolkit/); [MDCalc — MUST](https://www.mdcalc.com/calc/10190/malnutrition-universal-screening-tool-must); [Berkshire Healthcare — MUST for care homes](https://www.berkshirehealthcare.nhs.uk/media/253bkcv0/must-for-care-homes-with-action-plans.pdf)
- [NICE NG48 — Oral health for adults in care homes](https://www.nice.org.uk/guidance/ng48); [OHAT scoring guide (University of Iowa)](https://igec.uiowa.edu/ohat); [OHAT validity and reliability (Chalmers et al. 2005)](https://digital.library.adelaide.edu.au/items/ec598e72-b78a-4f4d-926d-c3143d7d8f34/full)
- [MHRA — Bed rails: management and safe use](https://www.gov.uk/government/publications/bed-rails-management-and-safe-use); [NHS England — Never Events](https://www.england.nhs.uk/patient-safety/never-events/)
- [HSE — Moving and handling equipment (hoists and slings)](https://hse.gov.uk/healthservices/moving-handling-equipment.htm); [Patient hoists — National Patient Safety Alert](https://assets.publishing.service.gov.uk/media/6aa3f3ac4e17456e2cdf53de/Patient_Hoists_NatPSA_-_Final.pdf)
- [IDDSI framework](https://iddsi.org/framework)
- [Tyne and Wear Fire — RPEEP template](https://www.twfire.gov.uk/wp-content/uploads/2026/04/RPEEPs-Template.pdf); [Dorset & Wiltshire Fire — RPEEP template](https://www.dwfire.org.uk/wp-content/uploads/2026/04/Template-RPEEPs-Prescribed-Information-For-FRS.docx)
