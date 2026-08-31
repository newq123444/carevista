-- 031_first_login.sql
-- A manager who adds a member of staff has to give them a way in. There is no
-- email server in a care home office, so the manager sets a temporary password
-- and hands it over in person. This flag makes the app force a change on the
-- first sign-in, so the temporary one — which the manager knows — stops working
-- as soon as it has been used once.
--
-- Existing accounts are untouched: the column defaults to false, so nobody who
-- is already working is suddenly locked into a password-change screen.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at  TIMESTAMPTZ;

COMMENT ON COLUMN users.must_change_password IS
  'Set when a manager issues a temporary password. Cleared when the person chooses their own.';
