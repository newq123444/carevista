-- ───────────────────────────────────────────────────────────────────────────
-- 039_plan_care_day.sql
--
-- "Plan the care day": the care plan says WHEN, and the round does it.
--
-- Until now a care plan said "reposition every 3 hours" in free text and the
-- round knew nothing about it — so the plan and the day drifted apart, and
-- the record of care could not be checked against the plan. Each scheduled
-- item here is one thing, at one time, from one section of the plan. Adding
-- it creates a task template for that resident; the round then shows it at
-- that time, and recording it ticks it off. Removing it switches the template
-- off. Nothing already recorded is touched.
--
-- Also adds the Abbey Pain Scale to the assessments a care plan can link to:
-- the standard tool for people who cannot say they are in pain.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care_plan_schedule (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  care_plan_id  UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  section_id    UUID NOT NULL REFERENCES care_plan_sections(id) ON DELETE CASCADE,
  resident_id   UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  due_time      TIME NOT NULL,
  day_of_week   SMALLINT CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  what          TEXT NOT NULL CHECK (length(btrim(what)) >= 3),

  template_id   UUID REFERENCES care_task_templates(id) ON DELETE SET NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_by    UUID REFERENCES users(id),
  removed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cps_plan ON care_plan_schedule(care_plan_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_cps_resident ON care_plan_schedule(resident_id) WHERE active;

-- Abbey Pain Scale alongside Waterlow, MUST and falls.
DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'risk_assessments'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%assessment_type%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE risk_assessments DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_assessment_type_check
    CHECK (assessment_type IN ('waterlow', 'must', 'falls', 'abbey_pain'));
END $$;

DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'risk_assessments'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%risk_level%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE risk_assessments DROP CONSTRAINT %I', c); END IF;
  -- Abbey's bands are no pain / mild / moderate / severe.
  ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_risk_level_check
    CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'very_high', 'mild', 'moderate', 'severe'));
END $$;
