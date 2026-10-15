# CareVista v78 — records that can prove themselves

## Why this, and not more features

You asked what the innovation is and why it would be hard to copy. The honest
answer about the previous 77 versions was: the features are good, but every
incumbent has them, and features are never a moat.

This release is a different kind of thing. It is not another screen. It changes
what a CareVista record *is*.

## The idea

Every care record is a legal document. It gets read in inquests, safeguarding
enquiries, CQC enforcement and negligence claims. Today, if a home is accused of
falsifying records, its only evidence is its own database — which its own
administrator can edit. And if a carer *does* falsify a record, nothing notices.

CareVista now addresses both.

## Records that cannot be quietly changed

Every care note, medication signature and completed task is now sealed into a
chain. Each entry locks in the one before it, so changing any past record breaks
everything after it — visibly, with the exact record named.

Find it under **Record Integrity → Check the records now**. It re-reads every
record and tells you whether any has been altered since it was written.

Things worth knowing:

- **Editing a note is allowed and is not treated as tampering.** An amendment is
  added alongside the original rather than replacing it — which is what clinical
  practice and CQC expect anyway. Both versions stay readable.
- **The chain cannot be edited even by the app itself.** The database refuses it
  outright. A chain the software could rewrite would prove nothing.
- **Deleting a note does not remove it.** It is withdrawn, and the withdrawal is
  recorded with who did it and when.

## Proving one record without exposing sixty others

Each day gets sealed with a single fingerprint covering everything recorded that
day. From that seal, one resident's record can be proved unaltered *without
revealing anybody else's*.

That matters more than it sounds. If a coroner asks about one resident's night
notes, the alternative is handing over every other resident's records for that
day — leaking sixty people's health data in the act of demonstrating good
practice. This avoids it.

## Records that look odd

Separate from the above, and answering a different question: not "was this
changed?" but "does this look right?".

**Record Integrity → Records worth checking** flags:

- care recorded for more residents than could be attended in the time
- records typed hours after the care happened
- a whole shift written up in one burst at the end of it
- care recorded for a resident who was in hospital
- care recorded by someone not on the rota *(off by default — see below)*

**These are prompts to check, not accusations, and the wording is deliberate.**
Nearly every one has an ordinary explanation: someone covering two floors, a
tablet with the wrong clock, a rota nobody updated. A system that accuses your
carers gets switched off within a week, and then it protects nobody. There is a
test in the build that fails if any message reads as an accusation.

Findings are visible to managers only. Each must be closed with a brief reason,
and that reason is itself sealed into the record — so if findings were being
waved through, that would be visible too.

The rota check ships **switched off**. It only works if your rota is reliably
up to date, and flagging a carer who genuinely turned up is exactly how a home
stops trusting the whole feature. Turn it on when you are ready.

## What this does NOT do

Written into the app itself, not just here, because a false assurance is worse
than none.

**It does not prove your records are true.** If a carer writes "ate a full
lunch" when the resident ate nothing, the chain proves only that this was
recorded at that time by that person. Integrity is not accuracy.

**Local sealing has a real limit.** By default the daily seals are stored in the
same database they protect. That catches accidental corruption and anyone
without database access — but somebody who *can* write to the database directly
could alter a record and recompute the seals to match. Closing that gap needs
the seals published somewhere outside your control, which is the "external
sealing" option in Settings. Until you configure it, the app says local-only and
will not claim otherwise.

**It will not catch a careful bad actor.** Someone on shift, writing a plausible
entry at a plausible time, is invisible to this. It catches careless
falsification and honest mistakes.

## For the visa file

`compliance/CareVista_Innovation_Claim.md` sets out the innovation claim for an
endorsing body, including a blunt section on what is *not* being claimed and an
honest ranking of how replicable each part is. `RECORD_INTEGRITY_THREAT_MODEL.md`
is the engineering threat model behind it.

One thing that document says and this one should too: your genuinely
unreplicable asset is twelve months of real outcome data from a real home. You
do not have it yet. This mechanism is a bridge to it, not a substitute.

## New build checks

`npm run check` now runs eight checks, each of which self-tests before reporting
a pass:

grammar · duplicate imports · undeclared dependencies · frontend↔backend routes ·
offline typecheck · task icons · hashed-field names · 119 unit tests

The route checker earned its place immediately: an earlier version was fooled by
column-aligned code and reported ten working endpoints as broken.

## Running it

```
cd backend  && npm install && npm run migrate && npm run build
cd frontend && npm install && npm run build
```

Migration **032** adds the chain. It is additive. Records made before it exist
outside the chain and will not be flagged — the chain protects from the day it
is switched on, which the Record Integrity page states.

## Still outstanding, unchanged

Before any real resident data: `ENABLE_DEMO_ACCOUNTS=false`, real accounts,
rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` and anything from the old committed
`.env`. The demo password is publicly known.
