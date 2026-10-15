-- ───────────────────────────────────────────────────────────────────────────
-- 036_prn_followup.sql
--
-- "As required" (PRN) medicines: record whether the dose worked.
--
-- NICE SC1 (Managing medicines in care homes) asks that the reason for a PRN
-- dose and its outcome are recorded. The columns for the reason and effect
-- existed from the start; nothing ever filled them in, and is_prn was never
-- set. These columns record who checked the effect and when, so a follow-up
-- can be shown as due, done, or late.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE med_administrations ADD COLUMN IF NOT EXISTS prn_effect_at TIMESTAMPTZ;
ALTER TABLE med_administrations ADD COLUMN IF NOT EXISTS prn_effect_by UUID REFERENCES users(id) ON DELETE RESTRICT;

-- The open follow-ups: PRN doses given with no outcome recorded yet.
CREATE INDEX IF NOT EXISTS idx_med_admin_prn_open
  ON med_administrations(care_home_id, created_at DESC)
  WHERE is_prn = TRUE AND status = 'given' AND prn_effect IS NULL;

-- Once recorded, the outcome is part of the medicines record. It can be
-- recorded once; a correction is a new note, not an overwrite.
CREATE OR REPLACE FUNCTION prn_effect_is_final() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.prn_effect IS NOT NULL
     AND (NEW.prn_effect IS DISTINCT FROM OLD.prn_effect
          OR NEW.prn_effect_at IS DISTINCT FROM OLD.prn_effect_at
          OR NEW.prn_effect_by IS DISTINCT FROM OLD.prn_effect_by) THEN
    RAISE EXCEPTION 'The effect of this PRN dose has already been recorded'
      USING HINT = 'Add a care note to correct or add to it.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prn_effect_is_final ON med_administrations;
CREATE TRIGGER trg_prn_effect_is_final
  BEFORE UPDATE ON med_administrations
  FOR EACH ROW EXECUTE FUNCTION prn_effect_is_final();
