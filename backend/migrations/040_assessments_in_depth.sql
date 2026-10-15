-- ───────────────────────────────────────────────────────────────────────────
-- 040_assessments_in_depth.sql
--
-- Assessments a nurse completes, not scores a computer guesses.
--
-- Until now Waterlow, MUST and falls were "auto-populated" from whatever the
-- record happened to hold, and falls produced a risk score that NICE NG249
-- (2025) now recommends against. From here an assessment is:
--   • answered by a named person, question by question (answers),
--   • scored by the server with a versioned tool (tool_version, result),
--   • final once saved — a reassessment is a new row that supersedes it,
--   • on the tamper-evident record chain,
--   • one "current" per resident per tool, enforced by the database.
--
-- Nine tools: Waterlow, MUST, falls (multifactorial, no score), moving and
-- handling, bed rails, eating/drinking and choking, oral health (OHAT),
-- PEEP, Abbey pain.
--
-- Care plans get structured details per area of care (IDDSI levels, sling
-- size, repositioning interval, PEEP category…) and per-need evaluations.
-- Old auto-populated rows are kept exactly as they were.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE risk_assessments
  ADD COLUMN IF NOT EXISTS answers            JSONB,
  ADD COLUMN IF NOT EXISTS result             JSONB,
  ADD COLUMN IF NOT EXISTS tool_version       VARCHAR(40),
  ADD COLUMN IF NOT EXISTS reason             VARCHAR(30),
  ADD COLUMN IF NOT EXISTS involvement        TEXT,
  ADD COLUMN IF NOT EXISTS supersedes_id      UUID REFERENCES risk_assessments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS assessor_name      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS assessor_role      VARCHAR(40),
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_to_plan_at TIMESTAMPTZ;

-- The nine tools.
DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'risk_assessments'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%assessment_type%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE risk_assessments DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_assessment_type_check
    CHECK (assessment_type IN ('waterlow', 'must', 'falls', 'abbey_pain', 'moving_handling', 'bed_rails',
                               'eating_drinking', 'oral_health', 'peep'));
END $$;

-- 'not_scored': falls, bed rails and PEEP have no risk score, by design.
DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'risk_assessments'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%risk_level%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE risk_assessments DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_risk_level_check
    CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'very_high', 'mild', 'moderate', 'severe', 'not_scored'));
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_assessments_reason_check') THEN
    ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_reason_check
      CHECK (reason IS NULL OR reason IN ('admission', 'scheduled', 'change', 'after_fall', 'after_hospital', 'other'));
  END IF;
  -- A completed (non-legacy) assessment always says who did it, when, with which tool.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_assessments_completed_whole') THEN
    ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_completed_whole
      CHECK (tool_version IS NULL OR (answers IS NOT NULL AND result IS NOT NULL AND completed_at IS NOT NULL AND assessor_name IS NOT NULL));
  END IF;
END $$;

-- One current assessment per resident per tool. Tidy any duplicates first,
-- keeping the newest, so this cannot fail on existing data.
UPDATE risk_assessments ra SET status = 'superseded', updated_at = NOW()
 WHERE ra.status = 'current'
   AND EXISTS (SELECT 1 FROM risk_assessments n
                WHERE n.resident_id = ra.resident_id AND n.assessment_type = ra.assessment_type
                  AND n.status = 'current' AND (n.created_at, n.id) > (ra.created_at, ra.id));
CREATE UNIQUE INDEX IF NOT EXISTS uq_risk_assessment_current
  ON risk_assessments(resident_id, assessment_type) WHERE status = 'current';
CREATE INDEX IF NOT EXISTS idx_risk_assessments_due
  ON risk_assessments(care_home_id, next_review_date) WHERE status = 'current';

-- Final once written. Only the status may move on (current → superseded or
-- overdue; never back from superseded), and the "applied to the care plan"
-- time may be set once. Nothing can be deleted.
CREATE OR REPLACE FUNCTION risk_assessment_is_final() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'An assessment cannot be deleted'
      USING HINT = 'Complete a new assessment. It replaces this one, and both stay on the record.';
  END IF;

  IF ROW(NEW.id, NEW.care_home_id, NEW.resident_id, NEW.assessed_by, NEW.assessment_type, NEW.total_score,
         NEW.risk_level, NEW.factors, NEW.auto_populated, NEW.next_review_date, NEW.notes, NEW.created_at,
         NEW.answers, NEW.result, NEW.tool_version, NEW.reason, NEW.involvement, NEW.supersedes_id,
         NEW.assessor_name, NEW.assessor_role, NEW.completed_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.care_home_id, OLD.resident_id, OLD.assessed_by, OLD.assessment_type, OLD.total_score,
         OLD.risk_level, OLD.factors, OLD.auto_populated, OLD.next_review_date, OLD.notes, OLD.created_at,
         OLD.answers, OLD.result, OLD.tool_version, OLD.reason, OLD.involvement, OLD.supersedes_id,
         OLD.assessor_name, OLD.assessor_role, OLD.completed_at)
  THEN
    RAISE EXCEPTION 'A completed assessment is final and cannot be changed'
      USING HINT = 'Complete a new assessment. It replaces this one, and both stay on the record.';
  END IF;

  IF OLD.status = 'superseded' AND NEW.status <> 'superseded' THEN
    RAISE EXCEPTION 'A superseded assessment cannot become current again';
  END IF;

  IF OLD.applied_to_plan_at IS NOT NULL AND NEW.applied_to_plan_at IS DISTINCT FROM OLD.applied_to_plan_at THEN
    RAISE EXCEPTION 'When an assessment was applied to the care plan is already recorded';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_risk_assessment_is_final ON risk_assessments;
CREATE TRIGGER trg_risk_assessment_is_final
  BEFORE UPDATE OR DELETE ON risk_assessments
  FOR EACH ROW EXECUTE FUNCTION risk_assessment_is_final();

-- ── Care plans: structured details and evaluations ──────────────────────────

ALTER TABLE care_plan_sections ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}';

-- "Is this part of the plan working?" — the monthly evaluation inspectors ask
-- to see. One row per evaluation, never edited.
CREATE TABLE IF NOT EXISTS care_plan_evaluations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  care_plan_id  UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  section_id    UUID NOT NULL REFERENCES care_plan_sections(id) ON DELETE CASCADE,
  resident_id   UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  progress      VARCHAR(10) NOT NULL CHECK (progress IN ('better', 'same', 'worse', 'met')),
  note          TEXT NOT NULL CHECK (length(btrim(note)) >= 10),
  still_right   BOOLEAN NOT NULL,
  evaluated_by  UUID NOT NULL REFERENCES users(id),
  evaluator_name VARCHAR(200) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpe_section ON care_plan_evaluations(section_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpe_resident ON care_plan_evaluations(resident_id, created_at DESC);

CREATE OR REPLACE FUNCTION care_plan_evaluation_is_final() RETURNS TRIGGER AS $$
BEGIN
  -- A delete cascading from the plan itself is allowed (depth > 1 means a
  -- foreign-key action fired this); touching one evaluation directly is not.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'A care plan evaluation cannot be changed or deleted'
    USING HINT = 'Add a new evaluation instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_care_plan_evaluation_is_final ON care_plan_evaluations;
CREATE TRIGGER trg_care_plan_evaluation_is_final
  BEFORE UPDATE OR DELETE ON care_plan_evaluations
  FOR EACH ROW EXECUTE FUNCTION care_plan_evaluation_is_final();

COMMENT ON TABLE care_plan_evaluations IS
  'Per-need evaluations of a care plan: is it working, and is the plan still right. Append-only.';
COMMENT ON COLUMN risk_assessments.answers IS
  'What the assessor answered, exactly as scored. NULL only on rows from before v88 (auto-populated).';
