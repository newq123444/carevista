# CareVista v86

Everything from the deep analysis, plus seven bugs found on the way — three of which a care home would have hit on day one.

**Database:** three new migrations (036 PRN follow-up, 037 soft signs, 038 offline records). Render applies them on start (`migrate:deploy`). Locally: `cd backend && npm run migrate`.

**Heads-up for demos:** the menu is shorter now. AI tools, Smart Rota, Digital Twin, wellbeing views, benchmarking and similar are under **Labs**, off by default. To show them in a demo: *Home Settings → Labs → Show Labs features in the menu*. Their pages still work by link either way.

---

## What's new

### For carers

- **Works with no signal.** The app opens, the round shows, and anything recorded is kept on the phone and sent by itself — in the order it was made — when the signal returns. A bar across the top says "No signal" or "3 records waiting to send". Signing out with unsent records warns you first. Each record keeps the phone's time, shown as *"device time, not verified"*. The database refuses device times more than 5 minutes ahead or 72 hours behind.
- **"Something's not right."** On the home screen and on every card in the round: pick the resident, tap what you've noticed (more sleepy, off their drinks, "not themselves"…), say whether you've told someone in person, send. Emergency signs (not responding, can't breathe, chest pain, stroke signs, a fit, heavy bleeding) come first, and ticking one shows **CALL 999 NOW** before anything else. Nurses are notified straight away.
- **"Did it work?"** An hour after an "as required" (PRN) dose, it appears on the home screen and the eMAR: it worked / partly / no effect / couldn't tell. "No effect" alerts a nurse.
- **In their language.** The simple screens, every quick-record option, the new screens and the default task names are in Polish, Romanian, Portuguese, Spanish and Hindi. **The record is always written in English** — only what's shown is translated — so the nurse, inspector or family reads the same note whoever wrote it.

### For nurses and managers

- **Soft Signs board** — every alert, emergencies first, with how long it has waited (red after 15 minutes with nobody looking). *I'm going to see them → Take NEWS2 → Record outcome*. Closing needs what you found and did; the database refuses it otherwise.
- **Weight trend (MUST).** Weight loss is now measured against the highest weight in the last six months, as MUST step 2 asks — not just since last time. Shows MUST step 1 (BMI) and step 2 scores, says plainly that step 3 and "was it planned?" need a nurse, and flags weighing more than a month overdue. A 10% change within a week says *re-weigh first*. New "Weight" filter on the Fluids, Food & Bowels board; trend panel on the resident's weight tab.
- **PRN reasons.** Giving an "as required" dose now asks why (pain, agitation, constipation…) — see the bugs below.
- **Pilot Evidence report** (menu → Tools). The same measures for a baseline period and the pilot period: care recorded on time, late, completed; fluid charts with 4+ drinks; days with a bowel entry; residents weighed; PRN effect recorded; MCA reviews overdue; soft-signs response time. Each figure shows the numbers behind it, its definition, and which way is better. No percentage where there are fewer than 20 cases. A baseline from a paper audit can be typed in, and is labelled as such. Prints with a "what this report cannot show" section. *This is the evidence pack for the endorsement interview.*
- **Independent timestamps for the daily seals (RFC 3161).** In *Record Integrity → Settings*, choose a timestamping service (DigiCert, Sectigo, GlobalSign or FreeTSA — free). Each finished day is then sealed and timestamped automatically within the hour. Only a fingerprint leaves the server. Each seal has a downloadable receipt and a "how to check" file, so a solicitor or inspector can verify it with OpenSSL **without trusting CareVista**. This closes the gap the threat model was honest about: someone with database access can no longer rewrite history undetected.
- **Shorter menu.** A manager's menu went from 87 items to 47, plus a folded *Setup* group. Experimental and analytics screens are under Labs.

### Behind the scenes

- **Pre-pilot safety check.** `npm run preflight -- --db` lists everything that makes a server unsafe for real records — demo accounts on, weak or published secrets, http origins, pending migrations, active demo users — with the fix for each. Set `PILOT_MODE=true` on the pilot server and it **refuses to start** while any of them is true. The demo server just logs a loud warning.
- **UK time on the server.** Task due times and "today" are now worked out in UK time regardless of the server's clock, tested across both clock changes and five server time zones.
- **CI now tests against a real Postgres:** migrations twice, then every trigger and constraint is attacked (edit the chain, delete a seal, rewrite a completed MCA, change a PRN outcome, alter a soft-signs alert…), then every new endpoint's SQL is run.

---

## Bugs found and fixed

1. **Carers were signed out every 15 minutes.** Access tokens last 15 minutes, and the app never used the refresh token the server was already issuing — so the next tap after a quarter of an hour signed the carer out mid-round. It now refreshes quietly, and only signs out if the refresh is refused.
2. **PRN doses were never recorded as PRN.** The eMAR form never sent "as required" or a reason, so every PRN dose looked like a scheduled one, with no reason — and a second PRN dose in the same round slot **overwrote the first**. Now the prescription decides it's PRN, a reason is required, and a second dose is kept as its own record.
3. **The NEWS2 form could save a perfect score nobody measured.** It opened with normal values (RR 16, SpO2 96, BP 120…) and saved them if untouched. Each reading must now be entered; untouched boxes are greyed and the save button waits.
4. **Weight loss alerts only compared with the last weighing,** so a resident losing 2% a month never triggered one. Fixed (above).
5. **Server dates were UTC** for the task board and the eMAR's default day — an hour out all summer, and "yesterday" between midnight and 1am.
6. **Reopening the app with no signal signed you out** (it treated "can't reach the server" as "not logged in"). Now it opens as the person last signed in on that phone.
7. **The backend was never type-checked before deploy** — only the frontend was. Added a strict backend check to `npm run check`; it caught two type errors in this release's own code before they reached Render.

---

## Checks

`npm run check` — 12 guards and **361 unit tests**, all passing. New guards: backend strict typecheck, and translations (every carer-screen phrase must exist in all five languages with matching placeholders). The new guards and the core new logic — UK time, weight trend, offline queue, pilot measures, the pre-pilot check, the timestamp checker — were mutation-tested: each was deliberately broken, and a test caught it.

The RFC 3161 code was tested against **OpenSSL's own Time-Stamp Authority**: OpenSSL accepts our requests, independently verifies our stored receipts (`Verification: OK`), and our checker rejects a token with an altered time and a genuine receipt replayed for a different seal.

## What I could not check — please do these

- **No database here.** Migrations 036–038, the triggers, and the new SQL (the Pilot Evidence report especially) have been reviewed but not run. CI runs all of it against Postgres on your next push — **check the "Smoke (E2E)" job in GitHub Actions is green before relying on any of it.**
- **No browser or phone here.** Nothing new has been seen on a screen. In particular, test offline on a real phone: open the round, turn on aeroplane mode, record two things, close and reopen the app, turn aeroplane mode off, and check both notes arrive in order. Offline needs the production build; after deploying, check that `https://<your-site>/sw-assets.json` loads.
- **No outbound access to DigiCert / Sectigo from here.** Timestamp one seal by hand on the live site (*Record Integrity → Sealed days → Timestamp now*) and run the OpenSSL check from the downloaded "how to check" file.
- **Translations are drafts written by an AI model.** Ask a carer who speaks each language to read the simple screens once. Hindi in particular should be seen on a phone to check the script renders well.
- **Clinical content** — the soft-signs list, MUST thresholds and PRN wording follow published practice (BAPEN MUST, NICE SC1, NHS 999 guidance), but have a nurse look at them before a pilot. The soft-signs screen is not RESTORE2 and doesn't claim to be.

## Before any real resident's data goes in

Unchanged from before, and now checkable: `ENABLE_DEMO_ACCOUNTS=false`, real accounts for each person, new `JWT_SECRET` / `JWT_REFRESH_SECRET` (`npm run gen-secrets`), rotate anything that was in an old committed `.env`, a separate pilot database (not the one your local `.env` points at), then `PILOT_MODE=true` and `npm run preflight -- --db` until it says PASS.

---

## v86b — "Connection terminated due to connection timeout" on start

- The first connection to a sleeping Neon database can take several seconds; the server allowed 5 and then gave up for good. It now allows 15 (`PG_CONNECT_TIMEOUT_MS` to change), tries 4 times over about 15 seconds, and if it still fails says what to check.
- New: `cd backend && npm run db:check` — tests the address, DNS, the port, the login and a query one at a time, and says which step failed and the usual fix. It never prints the password.

---

## v86c — the recording sheet on phones

- **The sheet was underneath the phone's top bar and bottom menu.** It sat at z-index 65; the phone bars are 150. On a phone the bottom menu covered **Back** and **Save**, and the top bar covered the title. The sheet, the "What happened?" sheet and the Undo bar are now above both.
- **On older phones the sheet could run off the bottom of the screen**, hiding Save. Its height used a newer CSS unit (`dvh`) that older phones ignore; there is now a fallback.
- **The round now fits between the phone's bars**, so Done / Problem / Not now are never under the bottom menu.
- **Blank boxes instead of pictures** ("☐ Afternoon Tea"): some icons were emoji from 2020 or later, which older Android phones and Windows 10 can't show. Replaced with older ones, and a new check (`check-emoji`) stops newer ones coming back.

Still not seen on a real phone from here — please open a quick-record sheet on your phone after deploying and check Save is visible without scrolling the page behind it.
