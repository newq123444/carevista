-- 018: personalise care tasks per resident
ALTER TABLE care_task_templates ADD COLUMN IF NOT EXISTS resident_id UUID REFERENCES residents(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ctt_resident ON care_task_templates(resident_id);

CREATE TABLE IF NOT EXISTS care_task_exclusions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  template_id  UUID NOT NULL REFERENCES care_task_templates(id) ON DELETE CASCADE,
  resident_id  UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, resident_id)
);
