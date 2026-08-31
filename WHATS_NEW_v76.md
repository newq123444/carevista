# CareVista v76 — Managing your team

## What you asked for

> "in team for manager, there is no option to add or remove staff, no option for
> editing or adding rota from excel, no option for adding preferences etc"
> "build everything n more if you can think of to make life easier"

## Add a member of staff

**Team → Staff Directory → + Add staff.**

Name, email, role, job title, phone, contract hours, start date. The role decides
what they can see — a carer cannot open the eMAR, a kitchen assistant cannot open
care notes.

**How they get in.** A care home office has no email server, so the app does not
try to send anybody a link. When you add someone, CareVista shows you a one-time
password on screen. Write it down or read it out. The next time they sign in they
are stopped at a "choose your own password" screen and cannot go anywhere else
until they have picked one.

That last part matters more than it sounds. Until they choose their own password,
you know how to sign in as them — so a care note signed with their name would not
truthfully be theirs. Blocking the app until they change it is what makes the
signature on a record mean something.

The one-time password is generated with a cryptographic random number generator,
avoids characters that get misread on paper (no 0/O, no 1/l/I), and is shown
exactly once. It is never emailed and never stored anywhere it can be read back.

## When someone leaves

**Team → Staff Directory → Left** (on their card).

Pick a reason and their last day. What happens:

- Their sign-in stops working straight away.
- Their record stays, and so does every care note they ever wrote. A care record
  that loses its author is not a care record.
- Any shifts they were down for in the future are removed, so the rota does not
  look covered when it is not — and the app tells you how many it removed.
- They move to the **Left** tab, out of the way of your day-to-day list.

Two things the app will not let you do, because both lock the home out of its own
records: you cannot remove your own access, and you cannot remove the last
remaining manager.

If someone comes back — bank staff often do — **Reinstate** puts them back with
their history intact.

## Importing your existing staff list

**Team → Staff Directory → ⬆ Import from Excel.**

Upload the spreadsheet you already keep. `.xlsx` or `.csv`, and column headings
are matched loosely — "First name", "Forename" and "Given name" all work; so do
"Role", "Job role" and "Position".

**Nothing is saved until you have seen what will happen.** The first pass is a
dry run: every row comes back with what the app intends to do with it and why —
including rows it will skip and rows where it did not recognise the job title and
will default to Carer. Only when you press "Add N people" does anything change.

Each person created comes back with their own one-time password in the table, and
you can download the whole list as a CSV to print and hand out.

There is a **Download a template** button if you would rather start from the shape
the app expects.

## Working preferences and availability

**Team → Staff Directory → 🗓 Availability** (on their card).

- **Preferred shifts** — days, evenings, nights, or any of them.
- **Maximum hours a week** — what they are willing to work, which can differ from
  their contract.
- **Will work weekends / will work bank holidays.**
- **Notice they need** before a shift is added.
- **Unavailability** — either a repeating one ("never Tuesday mornings — college")
  or a date range (annual leave, training, a hospital appointment). Each entry has
  a kind, so "cannot work" and "would rather not" are treated differently.

## Rota conflicts

The rota now checks itself against all of the above and tells you, before you
publish, where it disagrees with reality:

- **Hard** — someone is down for a shift on a day they said they cannot work, or
  two shifts that overlap, or a shift the night after a night shift.
- **Soft** — over their stated weekly maximum, on a weekend when they said no
  weekends, or on a day they would rather not.

Night shifts that cross midnight are handled properly rather than being counted
as two.

## Also in this release

- **Print and export.** The staff directory prints cleanly with the home's name
  and the date on it, and exports to CSV for payroll.
- **Editing a staff member** now includes their name, email and role. Previously
  a typo in someone's surname could not be fixed from the app.
- **A duplicate-import build guard.** The last two Vercel build failures were both
  the same thing — the same name imported twice in one file, which the old checks
  could not see. `npm run check` now catches it.

## Before you put real resident data in

Unchanged from previous releases and still the most important thing on this page:

1. Set `ENABLE_DEMO_ACCOUNTS=false`.
2. Create real accounts and delete the demo ones.
3. Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET`, and anything that was ever in a
   committed `.env`.

The demo password is publicly known. Until those three are done, putting real
records in would be a UK GDPR breach involving special-category health data.

## Running it

```
cd backend  && npm install && npm run migrate && npm run build
cd frontend && npm install && npm run build
```

Migration **031** adds the first-sign-in flag. It is additive and safe to run on a
live database — existing accounts default to "already chosen", so nobody who is
already working is suddenly stopped at a password screen.
