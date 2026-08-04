-- 020_resident_family_columns.sql
-- Safety migration: ensure the family-portal columns exist on residents.
-- These were declared in 001_init.sql, but databases first migrated from an
-- earlier version of that file never received them (001 is already recorded as
-- applied, so it never re-runs). Adding them idempotently here fixes those DBs
-- and is a no-op on databases that already have the columns.

ALTER TABLE residents ADD COLUMN IF NOT EXISTS family_portal_access BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS family_portal_user_id UUID REFERENCES users(id);
