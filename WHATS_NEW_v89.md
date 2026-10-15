# CareVista v89 — every assessment a care home needs, and the building too

You asked for the remaining assessments, and "all others possible like fire creams, evacuation". This release adds:

- **12 more resident assessments** (21 in total);
- **11 home safety checks** for the building;
- **the existing NEWS2, wounds, continence, MCA and DoLS records** brought into the assessments screens.

**Database:** one new migration, `041_more_assessments_home_safety.sql`. Render applies it on start; locally run `cd backend && npm run migrate`.

---

## 1. Twelve more resident assessments

Each new assessment works the same way as the v88 ones:

- **Answered by a person.** The record fills in what it already knows, and the person checks it.
- **Scored by the server.**
- **Final once saved.** A new assessment replaces the old one, and both stay on the record.
- **Sealed on the record chain.**
- **Linked to the care plan**, where the nurse chooses what goes in.

| Assessment | What it does | Based on |
|---|---|---|
| **Delirium (4AT)** | Scores 0–12. 4 or more means possible delirium: tell the nurse now, look for causes, and repeat daily. | 4AT (free to use, CC BY); NICE CG103 |
| **Mood (GDS-15)** | 15 yes/no questions. 5 or more means ask the GP to assess. If a few answers are missing, the score is scaled up from the rest, rounding up, as the author advises. People who cannot answer are directed to an observational assessment instead. | Geriatric Depression Scale (public domain); NICE NG222 |
| **Distress and behaviour support** | Covers what distress looks like, what triggers it, what prevents it and what calms it, plus an ABC chart. Medicines for distress get a warning to try non-drug approaches first, and restrictions get a DoLS warning. | NICE NG97 |
| **Leaving the building** | Covers the Herbert Protocol (the police form for people with dementia who go missing), what to do if they are missing, and capacity. It flags a likely deprivation of liberty when there is no DoLS. The DoLS status is filled in from the DoLS register. | Herbert Protocol; MCA / DoLS |
| **Hydration** | Risk factors, a daily target, and any fluid restriction from the doctor (the target cannot be set above it). For people at high risk it adds drink rounds to their day. It states that physical signs of dehydration are unreliable in older people. | UEA/Cochrane review; NHS guidance for care homes |
| **Looking after their own medicines** | NICE says to assume people can, unless this assessment shows otherwise. It requires lockable storage and respects capacity. Controlled drugs get a warning. It tells staff to mark self-administered medicines on the MAR chart. | NICE SC1, QS85; CQC |
| **Personal fire risk** | Smoking, **skin creams (emollients)**, oxygen, airflow mattresses, candles and heaters. Smoking combined with creams or oxygen is high risk. The MHRA warning is included: cream soaks into fabric and makes it burn fast, and washing does not remove it. Fire-retardant aprons and supervised smoking are offered as controls. | MHRA (via CQC and NHS SPS); NFCC |
| **Wheelchair and lap belt** | A chest harness used on its own is refused. Sliding down while wearing a belt is high risk because of the strangulation danger. A belt used to stop someone getting up is flagged as a restraint. It describes how to fit the belt correctly. | NHS wheelchair service guidance; coroner Prevention of Future Deaths report |
| **Bowels** | Bristol stool type, days since the bowels last opened (from the care notes), and risk factors. It escalates no bowel action for 3 days, overflow (soiling caused by impaction), pain with vomiting, and blood. Three or more loose stools trigger infection control. | NICE CKS |
| **Epilepsy and seizures** | Rescue medicine needs a signed protocol from the prescriber, and a trained person on every shift. It sets out what to do during and after a seizure, and when to call 999 (5 minutes or longer, or as the protocol says). | NICE NG217 |
| **Catheter** | Type, size, reason, the next change date (with a warning if overdue), and drainage. **No urine dipsticks**: cloudy or smelly urine on its own is not infection. Lists the real warning signs. | UKHSA; NICE CG139 |
| **Emotional safety** | Records what was said and who has been told. If there is a plan, intent or self-harm, it cannot be saved until the GP or mental health team is involved. It does **not** predict risk, because NICE advises against that. | NICE NG225 |

**For everyone, or only when needed.** Twelve assessments are for every resident; the other nine are only for the people they apply to, and each says when (for example, "for anyone with a urinary catheter"). The register doesn't count "when needed" assessments as never done.

**New facts carers see before they help.** These come from the plan once a nurse adds them:

- fluid restriction (in red)
- seizure rescue medicine (in red)
- medicines the resident looks after themselves ("do not give these")
- skin creams fire risk
- smoker
- Herbert Protocol in place
- may try to leave
- belt fitting
- bowel chart
- emotional safety plan

All the new care plan field names are translated into the five languages.

**Not included, on purpose.** Two common tools are copyrighted and need permission before they can go in a commercial product:

- **Cornell Scale for Depression in Dementia** (Elsevier). The mood assessment points people with dementia towards an observational assessment instead.
- **Clinical Frailty Scale** (Dalhousie University). A score given by a GP or hospital can be recorded as a care plan detail.

If you want either built in, ask the rights holders for permission first.

## 2. Home safety: the building, not the person

A new **Home safety** page (in the menu) lists **11 checks**. Each shows when it was last done and when it is due next. Every failing answer is graded:

- **Critical — act today.** The next check is then due within 7 days.
- **Major — this week.**
- **Minor — improve.**

Each one says exactly what to do. The checks are:

- **Fire risk assessment** — current, done by a competent person, its actions completed, and it covers night time, emollients, smoking and oxygen.
- **Fire safety checks** — weekly alarm test, panel, emergency lighting, fire doors, escape routes, training, and drills including night staff.
- **Evacuation readiness** — uses the residents' own PEEPs (personal emergency evacuation plans) to show:
  - who has no PEEP;
  - whether night staffing covers the resident who needs the most help;
  - whether there is evacuation equipment for those who need it.
- **Window restrictors** — openings of 100 mm or less, release only with a key, robust fixings.
- **Hot water and surfaces** — thermostatic mixing valves fitted, baths no hotter than 44°C, showers 41°C, radiators 43°C or covered.
- **Legionella** — hot water 50°C or more within 1 minute, cold below 20°C, little-used outlets flushed.
- **COSHH (hazardous substances)** — including **thickening powder kept out of reach**, which has caused deaths.
- **Hoists and lifts (LOLER)** — 6-monthly thorough examinations, and faulty equipment taken out of use.
- **Night and lone working.**
- **Oxygen storage.**
- **Electrical and gas** — 5-yearly electrical inspection (EICR), annual gas check, carbon monoxide alarms.

Home safety checks follow the same rules as resident assessments: final once saved, one current check of each kind per home, and sealed on the record chain. They support the competent-person inspections the law requires; they do not replace them.

## 3. Existing records brought in

The assessments register and each resident's Assessments tab now also show:

- the latest **NEWS2** score;
- **open wounds**;
- the **continence assessment**;
- **mental capacity** assessments;
- **DoLS** status and expiry.

Each one links to its own screen.

The register shows the 12 assessments for everyone by default; one button adds the 9 "when needed" ones.

---

## Checks

`npm run check` passes all 15 guards and **467 unit tests**. New tests:

- **17 for the new assessments:**
  - every 4AT band and the GDS key, including scaling up for missing answers;
  - each refusal and escalation listed in section 1.
- **9 for home safety:**
  - every safe answer passes;
  - critical findings bring the next check forward;
  - evacuation is worked out from the residents' PEEPs.
- **1 more for care plan facts.**

Database tests, which run in CI:

- **Integrity:** home safety checks cannot be edited, deleted or made current again, and there can be only one current check of each kind. The new assessment types are accepted.
- **Endpoints:** the home safety overview, the register's linked records, and the new record fields.
- **Writes, on the throwaway CI database only:** a 4AT scored 7 (high); a COSHH check with thickener left out (critical); and an incomplete check is refused.

## What I could not check — please do these

- **No browser or database here.** Push and confirm "Smoke (E2E)" is green; it runs migration 041 and the tests above. Then open Home safety, Assessments (with all 21 shown) and one resident's Assessments tab on a phone.
- **Clinical and safety review before a pilot.** A nurse should check the resident assessments, and your fire risk assessor or health and safety adviser should check the home safety items. In particular:
  - the hydration starting target;
  - the review intervals;
  - the night-staffing rule in evacuation readiness, which is a simple check and not a substitute for your fire risk assessor's judgement;
  - the bath and shower temperatures. These follow HSE and NHS guidance, but some local policies differ.
- **Translations:** 17 new phrases in each language are AI drafts.
- **Licences:** the 4AT (CC BY) needs attribution, which is included in the tool's sources. Ask the rights holders before adding Cornell or the Clinical Frailty Scale.

## Sources

- [4AT](https://www.the4at.com) · [4AT FAQ (licence)](https://www.the4at.com/4at-faq) · [NICE CG103 Delirium](https://www.nice.org.uk/guidance/cg103)
- [Geriatric Depression Scale — Yesavage, Stanford (public domain)](https://web.stanford.edu/~yesavage/GDS.html)
- [Cornell Scale — copyright (Danish Dementia Centre note)](https://videnscenterfordemens.dk/da/pdf/node/531) · [Clinical Frailty Scale — permission for use](https://www.dal.ca/sites/gmr/our-tools/permission-for-use.html)
- [NICE NG97 Dementia](https://www.nice.org.uk/guidance/ng97) · [NICE NG225 Self-harm](https://www.nice.org.uk/guidance/ng225) · [NICE NG217 Epilepsies](https://www.nice.org.uk/guidance/ng217)
- [Herbert Protocol](https://www.dorsar.org.uk/initiatives/herbert-protocol)
- [Hydration guidance for care homes (NEL ICB)](https://primarycare.northeastlondon.icb.nhs.uk/wp-content/uploads/2023/09/Hydration-Guidance-for-Care-Homes-V3.pdf) · [Bunn et al. — effective hydration care](https://ueaeprints.uea.ac.uk/id/eprint/71777/)
- [NICE QS85 self-administration](https://www.nice.org.uk/guidance/qs85/chapter/quality-statement-3-self-administration) · [CQC — self-administered medicines](https://www.cqc.org.uk/guidance-providers/adult-social-care/self-administered-medicines-care-homes)
- [CQC — fire risk from emollient creams](https://www.cqc.org.uk/guidance-regulation/adult-social-care/learning-safety-incidents/issue-3-fire-risk-use-emollient-creams) · [NHS SPS — emollients](https://sps.nhs.uk/?p=122272) · [Homecare Association — emollients guidance](https://www.homecareassociation.org.uk/resource/skin-care-creams-and-lotions-guidance.html)
- [Kent CHT — pelvic and lap belts](https://www.kentcht.nhs.uk/wp-content/uploads/2016/03/Safe-use-of-a-pelvic-lap-belt-or-safety-belt-00429-v7.pdf) · [PFD report — lap belt](https://www.judiciary.uk/prevention-of-future-death-reports/susan-lakin-prevention-of-future-deaths-report/)
- [UKHSA — UTI diagnosis](https://www.gov.uk/government/publications/urinary-tract-infection-diagnosis/diagnosis-of-urinary-tract-infections-quick-reference-tools-for-primary-care) · [Derbyshire — buccal midazolam](https://app.derbyshiremedicinesmanagement.nhs.uk/assets/Clinical_Guidelines/Formulary_by_BNF_chapter_prescribing_guidelines/BNF_chapter_4/Midazolam_for_primary_care.pdf)
- [HSE — falls from windows](https://www.hse.gov.uk/healthServices/falls-windows.htm) · [HSE — scalding and burning](https://www.hse.gov.uk/healthServices/scalding-burning.htm) · [HSE — legionella in health and social care](https://hse.gov.uk/healthservices/legionella.htm)
- [GOV.UK — Fire safety risk assessment: residential care premises](https://www.gov.uk/government/publications/fire-safety-risk-assessment-residential-care-premises)
