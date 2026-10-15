# CareVista v87 — looking and working like a real product

You compared CareVista with Person Centred Software's mCare and said it looked like a school project. You picked four gaps: **look and feel**, **resident-first recording**, **care plan depth**, and **feeling like a real app**. You also asked for fewer things done properly rather than everything at once. This release does those four.

**Database:** one new migration, `039_plan_care_day.sql`. Render applies it on start; locally, run `cd backend && npm run migrate`.

---

## 1. Look and feel

- **One design across the app.** It uses white surfaces, one teal brand colour, line icons, consistent spacing and type, and colour only where it means something. The buttons, cards, inputs, tables and dialogs that the existing screens already used have been restyled, so every screen improves at once, not just the new ones.
- **Proper icons instead of emoji.** There are 60 line icons, drawn the same way everywhere, in the menu, the bottom bar and the new screens. Emoji looked different on every phone and showed as blank boxes on older ones. The icon shapes are from Lucide (ISC licence, credited in `components/Icon.tsx`).
- **A new menu.** It is light, with icons and a search box, and *Start my round* sits at the top for carers, senior carers and nurses. Your name and role are at the bottom, with sign-out and dark mode. The phone top bar and bottom bar have also been redrawn.
- **No more emoji in page titles** (29 screens).
- **The manager dashboard** now shows the numbers that matter as calm cards. Colour appears only when something needs doing. The animated counters are gone and the weather is moved further down.
- **Dark mode was redone** to match, for night shifts.
- **A new sign-in page.** It is clean, explains what CareVista is in one line each, and has a password Show/Hide toggle.
  - Demo accounts now appear only when the server says demo sign-in is switched on. They never appear on a server holding real records.
  - The old unverified claims ("GDPR compliant · encrypted at rest") are gone.

## 2. Resident-first recording

This is the way mCare works and carers expect: start from the person, not the task.

- **Residents are a photo grid.** Each tile shows their photo, or their initials in a colour that is always theirs. It also shows the room and at most two flags that matter now:
  - *not themselves*
  - *behind on fluids*
  - *2 not recorded*
  - *in hospital*
  - *DNACPR*
  - A red or amber dot appears when something needs doing.
- **Filters and views.** You can filter to *Needs something* or *Away*, and there is still a list view with Mark away and Mark returned.
- **Record care** (menu, and a big button on the carer's home screen) asks "who are you with?". Tap their photo, then tap what you did. There are 12 picture tiles:
  - personal care, meal, drink, continence, turned/moved
  - sleep, mood and activity, behaviour
  - weight, observations, note, *something's not right*
  - Each one opens the same quick questions the round uses, so the note reads the same either way.
- **The matching task is ticked off for you.** If there's an open task on the round for the same care, recording from the resident ticks it off, so nobody does it twice. A drink closes the drinks round, not lunch. This is tested.
- **"Today so far"** sits beside it: everything recorded for that person today, in time order, with who did it.
- **Opening a resident now starts on Record.** The header shows their photo, preferred name, allergies, diet, DNACPR and live flags. The tabs have icons.
- It all works offline, in all five languages, and records stay in English.

## 3. Care plans with depth

- **The care plan reads like a person.** *About me* comes first, in their own words. Then comes *their day*: everything timed, in order. Then each need is shown as a card with:
  - what I need
  - what I want
  - how to support me
  - equipment and staff
  - status
  - the latest linked assessment (Waterlow for skin, MUST for eating, falls for mobility, Abbey for pain)
- **Plan the care day.** A nurse adds "14:00 — reposition, slide sheet, 2 carers" to a need. That creates a task for that resident, it appears on the round at 14:00, and recording it there ticks it off. This is the link between the plan and the care actually given that inspectors look for.
  - Items can be daily, or weekly on a chosen day.
  - Removing one stops it from today onward. Anything already recorded is never touched.
  - Medicines are refused here, because they are scheduled on the MAR chart.
- **Abbey Pain Scale** has been added, for residents who cannot say they're in pain. It has the six observed items, scored 0–3, with the published bands and advice for each band. It's on the Pain need.
- **One fix to existing behaviour.** Weekly tasks set for one resident now happen on the day you chose. Before, the day was picked automatically. Home-wide weekly tasks are still spread across the week.

## 4. Feels like a real app

- **Installs to the home screen.** It has its own icon, opens full screen without browser bars, and has shortcuts to *Start my round* and *Record care*.
  - Android and Chrome offer a one-tap *Install*. iPhones are shown the two steps (Share → Add to Home Screen).
  - The prompt is asked once; *Not now* waits two weeks.
- **A favicon, theme colour and app icon** are added. The old page referred to a favicon that didn't exist.

## Translations

Every new screen a carer sees is in Polish, Romanian, Portuguese, Spanish and Hindi. That is 643 phrases, and the build now fails if one is missing. These are still drafts I wrote: please ask a native speaker to read them.

---

## Honest gap analysis against PCS mCare

These come from the research for this release.

**Where CareVista now matches the everyday experience:**
- icon-driven recording from the resident
- works offline
- care plans with a timed care day
- linked assessments
- a timestamped, attributed audit trail
- one consistent professional look

**Where it is different, and arguably ahead:**
- records sealed on a tamper-evident chain, with independent RFC 3161 timestamps
- implausible-record detection
- carers record in their own language while the record stays in English
- a "something's not right" escalation from carer to nurse
- pilot evidence reporting with honest limits

**What code cannot close. These are what PCS has and a buyer will ask about:**

- **NHS Digital Social Care Records (DSCR) Assured Supplier List.** Suppliers on it must meet NHS England's standards, including the Minimum Operational Data Standard (MODS, DAPB4102). Homes can get funding for assured systems. Getting assured is an application and assessment, not a feature.
- **GP Connect and NHS integrations.** These need NHS onboarding (DSPT, a clinical safety case under DCB0129, and assurance).
- **Cyber Essentials Plus, a DSPT submission, and a DCB0129 clinical safety case.** These are certifications and documents.
- **Scale and support.** PCS reports thousands of providers, 60+ partner integrations, provided handsets and onboarding teams. An endorsing body will want to see your plan for support, not a match for their size.

For the endorsement, the strongest position is not "as big as PCS". It is: "the parts carers use every day are as good, and these specific things are new." The list above gives you that sentence.

---

## Checks

`npm run check` passes: 13 guards and 382 unit tests. The new guards:
- **Backend typecheck** (added in v86).
- **Emoji age.** It refuses emoji newer than 2019, which older phones can't show.
- **Translations.** It now also covers sign-in, residents, record care and care plans.

New tests:
- **Abbey Pain Scale:** band edges, missing items, invalid scores.
- **Care-day scheduling:** shift boundaries, refusing medicines, bad times, weekly days, every-N-hours wrapping past midnight.
- **Record-to-task matching:** other residents, closed tasks, medicines, drink vs meal, overdue first.

The database tests that run in CI now also cover the new assessment types. The endpoint test also loads a care plan with its day and linked assessments.

## What I could not check — please do these

- **No browser here.** I built the design as an HTML prototype and checked it by screenshot (`v87_prototype.html`, `v87_prototype_phone.html`). The React screens use the same stylesheet and markup, but none has been seen running. After deploying, open these on a phone and on a laptop:
  - Residents
  - a resident
  - Record care
  - a care plan
  - sign-in
- **No database here.** Migration 039 and the new SQL run in CI on your next push. Check that the "Smoke (E2E)" job is green.
- **Install to home screen** only works on the deployed HTTPS site, not on `localhost`.
- **Clinical content:** the Abbey items and bands follow the published scale. Have a nurse check the wording before a pilot.
- **Translations:** native-speaker check, as above.

## Sources

- [Person Centred Software — care planning](https://personcentredsoftware.com/products/digital-care-system/care-planning)
- [Care Tech Guide — mCare](https://caretechguide.co.uk/products/mcare-by-person-centred-software-pcs/)
- [Carerealm vs PCS comparison (May 2026)](https://www.carerealm.com/vs/person-centred-software)
- [PCS — Camascope eMAR integration](https://personcentredsoftware.com/resources/pcs-integrates-with-camascopes-emar-system)
- [NHS England — DSCR Minimum Operational Data Standard (DAPB4102)](https://standards.nhs.uk/published-standards/adult-social-care-digital-social-care-record-minimum-operational-data-specification)
- [Nourish — why NHS assurance matters](https://nourishcare.com/articles/why-nhs-assurance-matters-in-social-care/)
