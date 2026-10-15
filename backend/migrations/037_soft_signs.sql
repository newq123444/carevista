-- ───────────────────────────────────────────────────────────────────────────
-- 037_soft_signs.sql
--
-- "Something's not right": soft signs of deterioration, raised by anyone who
-- knows the resident, answered by a nurse or senior.
--
-- Carers usually notice first — more sleepy, off their food, "not
-- themselves" — long before a set of observations changes. This records who
-- noticed what, when, whether they also told someone in person, and what was
-- done about it. It is a prompt to assess, never a substitute for telling
-- someone, and never a substitute for 999.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deterioration_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  raised_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  raised_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signs           TEXT[] NOT NULL,
  other_text      TEXT,
  note            TEXT,
  told_in_person  BOOLEAN NOT NULL,
  emergency       BOOLEAN NOT NULL DEFAULT FALSE,

  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  acknowledged_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  acknowledged_at TIMESTAMPTZ,

  outcome         VARCHAR(30),
  outcome_note    TEXT,
  news2_score     SMALLINT,
  closed_by       UUID REFERENCES users(id) ON DELETE RESTRICT,
  closed_at       TIMESTAMPTZ,

  CONSTRAINT det_signs_present CHECK (cardinality(signs) >= 1 AND cardinality(signs) <= 30),
  CONSTRAINT det_status_valid CHECK (status IN ('open', 'acknowledged', 'closed')),
  CONSTRAINT det_outcome_valid CHECK (outcome IS NULL OR outcome IN
    ('news2_stable', 'monitoring', 'gp_contacted', 'nhs_111', 'ambulance_999', 'hospital', 'end_of_life_plan', 'no_concern')),
  CONSTRAINT det_news2_range CHECK (news2_score IS NULL OR news2_score BETWEEN 0 AND 20),
  -- Closing requires saying what was found and done. A queue that can be
  -- emptied without a word becomes one that is emptied without being read.
  CONSTRAINT det_closed_is_reasoned CHECK (status <> 'closed' OR (
    outcome IS NOT NULL AND closed_by IS NOT NULL AND closed_at IS NOT NULL
    AND outcome_note IS NOT NULL AND length(btrim(outcome_note)) >= 3))
);

CREATE INDEX IF NOT EXISTS idx_det_open     ON deterioration_alerts(care_home_id, raised_at DESC) WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS idx_det_resident ON deterioration_alerts(resident_id, raised_at DESC);

-- What was raised can never be changed, and once closed nothing changes.
CREATE OR REPLACE FUNCTION deterioration_alert_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'A soft-signs alert cannot be deleted';
  END IF;
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'This alert is closed and cannot be changed';
  END IF;
  IF ROW(NEW.care_home_id, NEW.resident_id, NEW.raised_by, NEW.raised_at, NEW.signs,
         NEW.other_text, NEW.note, NEW.told_in_person, NEW.emergency)
     IS DISTINCT FROM
     ROW(OLD.care_home_id, OLD.resident_id, OLD.raised_by, OLD.raised_at, OLD.signs,
         OLD.other_text, OLD.note, OLD.told_in_person, OLD.emergency) THEN
    RAISE EXCEPTION 'What was raised cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deterioration_alert_guard ON deterioration_alerts;
CREATE TRIGGER trg_deterioration_alert_guard
  BEFORE UPDATE OR DELETE ON deterioration_alerts
  FOR EACH ROW EXECUTE FUNCTION deterioration_alert_guard();
