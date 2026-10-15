-- ───────────────────────────────────────────────────────────────────────────
-- 038_offline_capture.sql
--
-- Records made on a phone with no signal and sent later.
--
-- client_recorded_at is the phone's clock at the moment the carer pressed
-- save. It is shown, labelled "device time, not verified", next to the
-- server's own created_at — which remains the authoritative time. It is
-- bounded: no more than 5 minutes ahead of the server (clock drift) and no
-- more than 72 hours behind (anything older is a late entry and must be
-- written as one, honestly).
--
-- client_ref lets a resend be recognised: if the phone sent a note, lost the
-- reply, and sends it again, the second copy returns the first instead of
-- creating a duplicate.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS client_recorded_at TIMESTAMPTZ;
ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS client_ref UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_care_notes_client_ref
  ON care_notes(care_home_id, client_ref) WHERE client_ref IS NOT NULL;

ALTER TABLE care_tasks ADD COLUMN IF NOT EXISTS client_recorded_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_notes_client_time_bounded') THEN
    ALTER TABLE care_notes ADD CONSTRAINT care_notes_client_time_bounded CHECK (
      client_recorded_at IS NULL OR (
        client_recorded_at <= created_at + INTERVAL '5 minutes' AND
        client_recorded_at >= created_at - INTERVAL '72 hours'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_tasks_client_time_bounded') THEN
    ALTER TABLE care_tasks ADD CONSTRAINT care_tasks_client_time_bounded CHECK (
      client_recorded_at IS NULL OR completed_at IS NULL OR (
        client_recorded_at <= completed_at + INTERVAL '5 minutes' AND
        client_recorded_at >= completed_at - INTERVAL '72 hours'));
  END IF;
END $$;
