# CareVista v83

Four things you asked for, and four bugs found on the way that mattered more than I expected.

**Run `npm run migrate`** — migrations 034 (bowels) and 035 (capacity assessments) are new.

---

## 1. Start my round — tasks for now, not the whole day

The round now works from the clock on the carer's phone:

- **In the deck:** tasks due from two hours ago up to thirty minutes ahead.
- **Earlier this shift and not recorded:** shown as an amber bar — "3 earlier tasks this shift not recorded — show". Missed care must stay visible, so it's one tap away rather than gone. When opened, these come *first*, and the card says "only record it if it was actually done".
- **Later this shift:** held back, so nobody records care before it happens.
- **Another shift's tasks:** never shown. Night checks don't appear on a day round, day tasks don't appear at night.

Nights crossing midnight are handled: at 01:00 the shift started yesterday at 20:00, so yesterday's 22:00 tasks are still "this shift". Tested at the shift edges and across three time zones.

The home screen and handover use the same logic, so "3 to do now" on the home screen is exactly what's in the deck. Handover also now shows anything the **previous** shift didn't record.

Shift times are 07:00 and 20:00 by default; they're a single setting if your homes run 08:00–20:00.

## 2. Mental Capacity Act assessments

**Mental Capacity (MCA)** in the menu. A full, decision-specific assessment:

1. **The decision** — one specific decision; why capacity is in doubt; what they need to understand (with suggestions for each kind of decision).
2. **Support given** — what was done to help them decide for themselves (s1(3)), when, where, who was there, whether their capacity fluctuates.
3. **The test** — in the order the Supreme Court set in *A Local Authority v JB* [2021] UKSC 52: understand, retain, use or weigh, communicate — each with evidence in the person's words — then whether there's an impairment, and whether the inability is *because of* it.
4. **Outcome** — the screen tells you what outcome your evidence supports.
5. **Best interests** (only if they lack capacity) — LPA and deputy checks, advance decisions, whether they may regain capacity, their wishes, feelings, beliefs and values, who was consulted and what they said, IMCA where required, options with benefits and burdens, the least restrictive choice.
6. **Liberty** (where relevant) — the *Cheshire West* acid test, and DoLS authorisation.
7. **Review date**, then sign.

It checks as you go. Every check shows the section of the Act or paragraph of the Code it comes from. It **refuses** to complete when, for example:

- the decision is global ("lacks capacity for all decisions");
- you conclude "lacks capacity" but your evidence shows they can do all four parts of the test;
- there's an inability but no causal link to an impairment;
- someone lacks capacity and nothing was done to help them decide;
- a health and welfare attorney covers the decision but the home is recorded as the decision-maker;
- there's nobody to consult about a move and no IMCA has been instructed;
- it's covert medication and the prescriber and a pharmacist weren't involved;
- it amounts to a deprivation of liberty with no DoLS application.

It also warns — without blocking — when a reason for doubt rests only on a diagnosis, when "unable to weigh" evidence reads like an unwise decision, and when "unable to communicate" doesn't say what other means were tried.

Completed assessments are **final**. The database itself refuses edits. To reassess, start a review: it creates a new assessment that supersedes the old one, carries forward the decision and who matters to the person, and resets the test — a reassessment that copies last time's answers isn't one. Completed assessments are sealed on the record integrity chain, including the evidence, and print as a structured record.

The register shows reviews overdue, reviews due in 30 days, current deprivations of liberty and drafts.

**On the law, as of this release:** DoLS (Schedule A1) is the scheme in force. The Liberty Protection Safeguards were legislated in 2019 but have not been commenced; the government committed to a new consultation in 2026, which I couldn't confirm had launched. A Supreme Court reference from Northern Ireland touching on these questions was pending at last check. If LPS is ever commenced, or the revised Code of Practice is laid, this module must be reviewed.

**Before relying on it:** please have your MCA lead or a Best Interests Assessor go through it. It checks that the recorded reasoning is complete and consistent; it does not, and must not, make the judgement.

## 3. Fluids, food and bowels — on the go

**💧 Intake** on the phone's bottom bar for nurses and managers, with a red badge counting residents who need action now. Also in the menu as *Fluids, Food & Bowels*.

For every resident, today: fluids against their target with a progress bar and the time of the last drink; meals and average eaten; and when their bowels last opened. Sorted worst first. Each concern is a sentence you can act on — "640 ml so far — well behind the 1,100 ml expected by now", "Bowels last opened 3 days ago", "3 loose stools today — consider infection control and tell the nurse". Tap a card to see every drink with time and who gave it.

It deliberately does not:

- **invent fluid targets.** Only residents with a target set on their chart are measured against one. A made-up 1,500 ml would turn half the home amber, and an always-amber board gets ignored.
- **treat "not recorded" as "drank nothing".** It says which it is.
- **flag anyone who's away** — in hospital, on home leave.

Bowels are now recorded as data (opened yes/no, and hard/normal/loose matching the Bristol bands on the form), from both the quick sheet and the full form. Older notes still count, read from their wording.

## 4. Fluid slider

Recording a drink now gives an exact amount — 120 ml is 120 ml. A large readout, a slider, big **−50 −10 +10 +50** buttons (sliders are fiddly in gloves), one-tap cup sizes, and "Drank nothing". It asks what they *actually* drank, not what was offered. In the simple view and the full carer form.

---

## Bugs found and fixed

**Fluids recorded on the full carer form never reached the fluid chart.** They were stored only inside a JSON field the fluid chart, MUST trend and monitoring alerts didn't read. Fixed going forward, and the charts now also read the old ones from that field — so your history appears without any stored note being altered (altering them would rightly show as tampering on the integrity chain).

**Every other card was being skipped in the round.** The deck tracked position by number; when a card was recorded it left the list and the number then pointed one card too far. It now tracks cards by identity.

**"Undo" didn't undo.** It moved you back a card and left the record in place. Undo is now real: within ten minutes, by the person who recorded it, the task is reopened and the note written with it is withdrawn as "recorded in error". Both the record and the reversal stay on the integrity chain. After ten minutes it's a correction, not a mis-tap, and goes through an amendment.

**Dates were UTC.** Between midnight and 1am all summer, the round and the fluid chart showed yesterday. Fixed in the screens touched here.

Two of the build guards were also quietly checking less than they claimed, and both are fixed: the task-status guard had started accepting `'pending'` (my new reopen code writes it, but the API never returns it), and it had stopped looking at the simple screens altogether. It now refuses to run if those screens drop out of scope.

---

## What I could not check, and one thing I chose not to fix

- **No database here.** Migrations 034 and 035, the immutability trigger, and the new SQL have been reviewed but not run. Run the migrations on a copy first.
- **No browser here.** Nothing in this release has been seen on a screen. Open the round, the slider, the intake board and an MCA assessment on a real phone before showing them to anyone.
- **The server's clock is UTC with no timezone set.** So in British Summer Time, the server thinks a task due at 08:00 is due at 09:00, and the full Task Board's colours are an hour out from April to October. The new screens work around this by doing the timing on the phone. I did **not** change the server's timezone, because dates come back from Postgres as midnight-in-server-time and changing it blind could shift dates by a day across the app. The proper fix is a two-line change (read DATE columns as plain strings, then set `TZ=Europe/London`) that needs a real database to test against. Worth doing next, with the database in front of us.

## Checks

`npm run check` — all ten guards pass, and **252 tests** (up from 148 in v82), including 49 for the Mental Capacity engine, 25 for the intake board and 23 for the round's time window. Each MCA rule I deliberately broke was caught by a failing test.
