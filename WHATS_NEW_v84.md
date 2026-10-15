# CareVista v84 — migrations actually get applied

## The problem

"relation mca_assessments does not exist" means the code is ahead of the database:
migration 035 was never applied to the database the server is using.

Looking into it found the bigger cause: **the Render deploy never ran migrations.**
It installed, compiled and started — nothing ever applied new migration files. Every
release that added a table relied on someone running `npm run migrate` by hand
against the right database.

## What changed

- **Deploys now migrate first.** `render.yaml` starts with
  `npm run migrate:deploy && node dist/index.js`. If a migration fails the server does
  not start and Render keeps the previous version live — better than new code on an old
  database. **If your Render service was created in the dashboard rather than from
  render.yaml, set this Start Command there by hand** (Settings → Start Command).
- **`npm run migrate` says which database it is touching**, lists what it is about to
  apply, and on failure shows the file, the line, Postgres's own detail and hint, and
  exactly which files were not applied.
- **`npm run migrate:status`** — shows applied and pending without changing anything.
- **The server warns at startup** if any migrations are pending, naming them.
- **`/health/migrations`** — returns 503 with the list if anything is pending.
- **A missing table now returns a clear message** ("the database is missing X — run
  npm run migrate") instead of a raw Postgres error, and managers see a banner saying a
  database update is needed instead of screens that look empty for no reason.

## To fix it now

From the **v84 `backend` folder** — not the old v35 one:

```
npm run migrate:status
npm run migrate
```

then restart the backend. If `migrate` stops with ❌, the output now says exactly why.
