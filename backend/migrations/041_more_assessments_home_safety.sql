-- ───────────────────────────────────────────────────────────────────────────
-- 041_more_assessments_home_safety.sql
--
-- Twelve more resident assessments (v89): 4AT delirium, GDS-15 mood,
-- distress and behaviour support, leaving the building, hydration,
-- self-administering medicines, personal fire risk (smoking, emollients,
-- oxygen), wheelchair and lap belt, bowels, seizures, catheter, emotional
-- safety. They use the same table, rules and record chain as v88's nine.
--
-- And home safety checks — the building rather than the person: fire risk
-- assessment, fire safety checks, evacuation readiness, windows, hot water,
-- legionella, COSHH, lifting equipment, night working, oxygen storage,
-- electrical and gas. Same principles: answered by a named person, scored by
-- the server, final once saved, one current per check, on the chain.
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'risk_assessments'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%assessment_type%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE risk_assessments DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_assessment_type_check
    CHECK (assessment_type IN (
      'waterlow', 'must', 'falls', 'abbey_pain', 'moving_handling', 'bed_rails', 'eating_drinking', 'oral_health', 'peep',
      'delirium_4at', 'mood_gds15', 'behaviour_support', 'leaving_building', 'hydration', 'self_medication',
      'personal_fire', 'wheelchair_belt', 'bowel', 'seizure', 'catheter', 'emotional_safety'));
END $$;

CREATE TABLE IF NOT EXISTS premises_assessments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  check_type      VARCHAR(40) NOT NULL CHECK (check_type IN (
                    'fire_risk_assessment', 'fire_safety_checks', 'evacuation', 'window_restrictors', 'hot_water',
                    'legionella', 'coshh', 'lifting_equipment', 'night_working', 'oxygen_storage', 'electrical_gas')),
  area            VARCHAR(120),
  answers         JSONB NOT NULL,
  result          JSONB NOT NULL,
  level           VARCHAR(10) NOT NULL CHECK (level IN ('low', 'medium', 'high')),
  failures        INT NOT NULL DEFAULT 0,
  tool_version    VARCHAR(40) NOT NULL,
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'superseded')),
  supersedes_id   UUID REFERENCES premises_assessments(id) ON DELETE RESTRICT,
  next_due        DATE NOT NULL,
  assessed_by     UUID NOT NULL REFERENCES users(id),
  assessor_name   VARCHAR(200) NOT NULL,
  assessor_role   VARCHAR(40),
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_premises_current ON premises_assessments(care_home_id, check_type) WHERE status = 'current';
CREATE INDEX IF NOT EXISTS idx_premises_home ON premises_assessments(care_home_id, completed_at DESC);

CREATE OR REPLACE FUNCTION premises_assessment_is_final() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'A home safety check cannot be deleted'
      USING HINT = 'Complete a new check. It replaces this one, and both stay on the record.';
  END IF;
  IF ROW(NEW.id, NEW.care_home_id, NEW.check_type, NEW.area, NEW.answers, NEW.result, NEW.level, NEW.failures,
         NEW.tool_version, NEW.notes, NEW.supersedes_id, NEW.next_due, NEW.assessed_by, NEW.assessor_name,
         NEW.assessor_role, NEW.completed_at, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.care_home_id, OLD.check_type, OLD.area, OLD.answers, OLD.result, OLD.level, OLD.failures,
         OLD.tool_version, OLD.notes, OLD.supersedes_id, OLD.next_due, OLD.assessed_by, OLD.assessor_name,
         OLD.assessor_role, OLD.completed_at, OLD.created_at)
  THEN
    RAISE EXCEPTION 'A completed home safety check is final and cannot be changed'
      USING HINT = 'Complete a new check. It replaces this one, and both stay on the record.';
  END IF;
  IF OLD.status = 'superseded' AND NEW.status <> 'superseded' THEN
    RAISE EXCEPTION 'A superseded home safety check cannot become current again';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_premises_assessment_is_final ON premises_assessments;
CREATE TRIGGER trg_premises_assessment_is_final
  BEFORE UPDATE OR DELETE ON premises_assessments
  FOR EACH ROW EXECUTE FUNCTION premises_assessment_is_final();

COMMENT ON TABLE premises_assessments IS
  'Home safety checks (v89): fire, evacuation, windows, water, COSHH, LOLER, night working, oxygen, electrical and gas. Final once saved; a new check supersedes.';
