-- ───────────────────────────────────────────────────────────────────────────
-- 034_structured_bowels.sql
--
-- Bowel care has only ever been recorded as text. Everything that needed to
-- know "when did this person last open their bowels" searched the note text
-- for the phrase "bowels opened", which misses anything worded differently and
-- cannot tell a normal stool from diarrhoea.
--
-- Constipation in care homes causes pain, agitation, falls, delirium and
-- hospital admissions; three or more loose stools in a day may be the first
-- sign of an outbreak. Both deserve a field, not a text search.
--
-- Stool type is stored as the band the carer recorded (hard / normal / loose),
-- matching the Bristol ranges offered on the form (1–2, 3–4, 5–7). An exact
-- Bristol number is not invented from a range.
--
-- Additive only. Historic notes keep NULL and the readers fall back to the old
-- text match for them, so nothing already recorded is altered — which matters,
-- because altering a recorded note would correctly show up as tampering on the
-- record integrity chain.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS bowels_opened BOOLEAN;
ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS stool_type    VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_notes_stool_type_check') THEN
    ALTER TABLE care_notes ADD CONSTRAINT care_notes_stool_type_check
      CHECK (stool_type IS NULL OR stool_type IN ('hard', 'normal', 'loose'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_care_notes_bowels
  ON care_notes (resident_id, created_at DESC) WHERE bowels_opened IS TRUE;
