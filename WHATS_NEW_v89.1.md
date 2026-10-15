# CareVista v89.1 — two staff, one resident, one record

You reported that two staff writing about the same person can make a duplicate entry. You were right. There were four separate ways it could happen. This release closes all four, and adds a way to stop the second carer before they even start.

**Database:** one new migration, `042_care_presence.sql` (Render applies it on start).

## The four holes, and what changed

**1. Pressing Save at the same moment.**

- *Before:* the server checked "has anyone recorded this care recently?" and then saved, as two separate steps. Two carers saving within the same second both passed the check, so both notes went in.
- *Now:* the check and the save happen together while holding a lock on that resident's notes. The second carer's save waits for the first to finish, then sees it and is asked: "Ana already recorded a personal care note for this resident 0 minutes ago. Check it is not the same care before saving another."

**2. The round wrote the note before ticking the task.**

- *Before:* if another carer had already finished that task, the note was saved first and only then did the tick fail with "already done". A second note was left behind.
- *Now:* the note and the tick are **one request**: both are saved, or neither is. If someone finished the task first, nothing is saved and the carer sees who did it and when. They can still choose "Save your note anyway" if it really was different care.
- The same fix applies to the round, Record care, and the carer dashboard.

**3. Notes made offline were compared with the wrong time.**

- *Before:* a note made with no signal and sent an hour later was checked against what had been recorded in the last 20 minutes, not around the time the care actually happened.
- *Now:* the check uses the time the care happened (the phone's time) and looks before and after it.

**4. A refused note could be lost.**

- *Before:* if a task had been finished by someone else while a carer's note was waiting on their phone, the note could be quietly thrown away.
- *Now:* it stays on the phone and is shown to the carer, with "It is not a duplicate — send".

**Fewer false alarms, so staff keep reading the warning.**

| Situation | Treated as a possible duplicate? |
|---|---|
| A meal and a drink close together | No — they are different care. |
| Two drinks | Only if they are the same amount within 10 minutes. |
| The same personal care, continence or similar | Yes, within 20 minutes. |
| Observations, behaviour, incidents, medicine notes | Yes, but only within 5 minutes, because these legitimately repeat. |

## Stop the second carer before they start

**"Ana is with Ernie — personal care, 3 min ago."**

- On the **round**, opening the record sheet for a task now claims it. Anyone else who opens the same task is told who has it and asked "Carry on anyway?".
- On **Record care**, opening a tile tells the others. Anyone starting the *same* care for the same person is asked: "Ana started personal care for Ernie 3 minutes ago. Is this different care?". Other carers see the "is with them" line on the resident's Record care page and a "With Ana" flag on the residents grid.
- This is not a care record. It clears when the carer saves or cancels, and it expires after 15 minutes anyway.

All new wording is in the five languages, as drafts.

## Proof

- **Unit tests:** 476 in total. They include 7 new tests for the duplicate rules and 2 new offline-queue tests.
- **New CI database tests** run on real Postgres, against a fresh test resident, firing two requests at exactly the same moment:
  - two identical notes → **one saved, one asked**;
  - two completions of the same task with notes → **one note, and the other carer told who did it**;
  - "save anyway" on a finished task → **saves the note only**.
- Before this release, those first two tests would have saved two notes. They run on your next push: check that "Smoke (E2E)" is green.

## Please check on phones

Take two phones signed in as two carers, both open on the same resident:

1. Open personal care on both.
2. The second phone should ask before letting you start.
3. Save on both. Only one note should be saved, and the second carer should be told who already recorded it.
