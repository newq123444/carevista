-- 021_room_turnover_status.sql
-- The room-turnover pipeline UI uses richer stage names (cleaning, maintenance,
-- inspection) than the original CHECK constraint allowed, causing status updates
-- to fail. Widen the constraint to match the workflow.

ALTER TABLE room_turnovers DROP CONSTRAINT IF EXISTS room_turnovers_status_check;
ALTER TABLE room_turnovers ADD CONSTRAINT room_turnovers_status_check
  CHECK (status IN ('vacated','cleaning','maintenance','inspection','in_progress','ready','allocated'));
