-- ───────────────────────────────────────────────────────────────────────────
-- 043_home_customisation.sql
--
-- The home's own care plan sections, its own care plan fields, and its own
-- assessments (v90).
--
--   care_plan_section_types  — e.g. "Stoma care", "Faith & culture". Added to
--                              any resident's plan; optionally to every new plan.
--   care_detail_fields       — extra fields on any area of the plan (built-in
--                              or the home's own), optionally shown to carers.
--   custom_assessment_tools  — assessments built by the home. A published
--                              version is frozen; editing creates the next
--                              version. Completed assessments point at the
--                              exact version they were scored with.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care_plan_section_types (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id     UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  domain_key       VARCHAR(40) NOT NULL UNIQUE CHECK (domain_key ~ '^custom_[a-z0-9]{8,24}$'),
  label            VARCHAR(80) NOT NULL CHECK (length(btrim(label)) >= 2),
  hint             TEXT,
  icon             VARCHAR(40) NOT NULL DEFAULT 'clipboard-list',
  note_type        VARCHAR(40) NOT NULL DEFAULT 'personal_care',
  add_to_new_plans BOOLEAN NOT NULL DEFAULT FALSE,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_section_type_label ON care_plan_section_types(care_home_id, lower(label));

-- Care plan sections may now be one of the built-in fifteen, or the home's own.
DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'care_plan_sections'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%domain%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE care_plan_sections DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE care_plan_sections ADD CONSTRAINT care_plan_sections_domain_check
    CHECK (domain IN ('personal_care','mobility_transfers','nutrition_hydration','continence','skin_integrity',
                      'medication','pain','breathing_circulation','communication_sensory','cognition_mental_health',
                      'behaviour_support','social_emotional','night_care','safety_risk','end_of_life')
           OR domain ~ '^custom_[a-z0-9]{8,24}$');
END $$;

CREATE TABLE IF NOT EXISTS care_detail_fields (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  domain        VARCHAR(40) NOT NULL,
  field_key     VARCHAR(48) NOT NULL CHECK (field_key ~ '^x_[a-z0-9_]{1,40}$'),
  definition    JSONB NOT NULL,
  sort_order    INT NOT NULL DEFAULT 100,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (care_home_id, domain, field_key)
);

CREATE TABLE IF NOT EXISTS custom_assessment_tools (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  -- All versions of one assessment share a family; the register shows one column per family.
  family_id     UUID NOT NULL,
  version       INT NOT NULL CHECK (version >= 1),
  status        VARCHAR(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  definition    JSONB NOT NULL,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by  UUID REFERENCES users(id),
  published_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, version),
  CONSTRAINT custom_tool_published_whole CHECK (status = 'draft' OR (published_at IS NOT NULL AND published_by IS NOT NULL))
);
-- One published (live) version per family at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_tool_live ON custom_assessment_tools(family_id) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_custom_tools_home ON custom_assessment_tools(care_home_id, status);

-- A published version is frozen. It may only be retired (when a newer one is
-- published, or the home stops using it). Drafts can be edited or deleted.
CREATE OR REPLACE FUNCTION custom_tool_is_frozen() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'draft' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'A published assessment cannot be deleted' USING HINT = 'Retire it instead; completed assessments refer to it.';
  END IF;
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF NEW.definition IS DISTINCT FROM OLD.definition OR NEW.version <> OLD.version OR NEW.family_id <> OLD.family_id
     OR NEW.care_home_id <> OLD.care_home_id OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'A published assessment is frozen' USING HINT = 'Make a new version instead.';
  END IF;
  IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
    RAISE EXCEPTION 'A retired assessment version cannot be brought back' USING HINT = 'Publish a new version instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_custom_tool_is_frozen ON custom_assessment_tools;
CREATE TRIGGER trg_custom_tool_is_frozen BEFORE UPDATE OR DELETE ON custom_assessment_tools
  FOR EACH ROW EXECUTE FUNCTION custom_tool_is_frozen();

-- Completed custom assessments live with the built-in ones.
ALTER TABLE risk_assessments
  ADD COLUMN IF NOT EXISTS custom_tool_id   UUID REFERENCES custom_assessment_tools(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS custom_family_id UUID;

DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'risk_assessments'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%assessment_type%' AND pg_get_constraintdef(oid) NOT ILIKE '%custom_tool_id%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE risk_assessments DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_assessment_type_check
    CHECK (assessment_type IN (
      'waterlow', 'must', 'falls', 'abbey_pain', 'moving_handling', 'bed_rails', 'eating_drinking', 'oral_health', 'peep',
      'delirium_4at', 'mood_gds15', 'behaviour_support', 'leaving_building', 'hydration', 'self_medication',
      'personal_fire', 'wheelchair_belt', 'bowel', 'seizure', 'catheter', 'emotional_safety', 'custom'));
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risk_assessments_custom_link') THEN
    ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_custom_link
      CHECK ((assessment_type = 'custom') = (custom_tool_id IS NOT NULL AND custom_family_id IS NOT NULL));
  END IF;
END $$;

-- One current assessment per resident per tool — and, for the home's own,
-- per assessment family.
DROP INDEX IF EXISTS uq_risk_assessment_current;
CREATE UNIQUE INDEX IF NOT EXISTS uq_risk_assessment_current
  ON risk_assessments(resident_id, assessment_type, COALESCE(custom_family_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'current';

-- The final-once-saved rule now covers the custom links too.
CREATE OR REPLACE FUNCTION risk_assessment_is_final() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'An assessment cannot be deleted'
      USING HINT = 'Complete a new assessment. It replaces this one, and both stay on the record.';
  END IF;
  IF ROW(NEW.id, NEW.care_home_id, NEW.resident_id, NEW.assessed_by, NEW.assessment_type, NEW.total_score,
         NEW.risk_level, NEW.factors, NEW.auto_populated, NEW.next_review_date, NEW.notes, NEW.created_at,
         NEW.answers, NEW.result, NEW.tool_version, NEW.reason, NEW.involvement, NEW.supersedes_id,
         NEW.assessor_name, NEW.assessor_role, NEW.completed_at, NEW.custom_tool_id, NEW.custom_family_id)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.care_home_id, OLD.resident_id, OLD.assessed_by, OLD.assessment_type, OLD.total_score,
         OLD.risk_level, OLD.factors, OLD.auto_populated, OLD.next_review_date, OLD.notes, OLD.created_at,
         OLD.answers, OLD.result, OLD.tool_version, OLD.reason, OLD.involvement, OLD.supersedes_id,
         OLD.assessor_name, OLD.assessor_role, OLD.completed_at, OLD.custom_tool_id, OLD.custom_family_id)
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
