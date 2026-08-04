-- ============================================================
-- Care Task Templates & Care Tasks
-- Provides task management for daily care routines
-- ============================================================

-- ── CARE TASK TEMPLATES ──────────────────────────────────────────────────

CREATE TABLE care_task_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  name            VARCHAR(200) NOT NULL,
  icon            VARCHAR(100),
  category        VARCHAR(100),
  shift           VARCHAR(50),
  due_time        TIME,
  window_mins     INTEGER,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  applies_to      VARCHAR(100) DEFAULT 'all',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_care_task_templates_care_home ON care_task_templates(care_home_id);
CREATE INDEX idx_care_task_templates_active ON care_task_templates(care_home_id, active) WHERE active = TRUE;

-- ── CARE TASKS ───────────────────────────────────────────────────────────

CREATE TABLE care_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  template_id     UUID REFERENCES care_task_templates(id) ON DELETE SET NULL,
  task_date       DATE NOT NULL,
  task_name       VARCHAR(200) NOT NULL,
  icon            VARCHAR(100),
  category        VARCHAR(100),
  due_time        TIME,
  window_mins     INTEGER,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  completed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint to support ON CONFLICT DO NOTHING in seed/inserts
CREATE UNIQUE INDEX idx_care_tasks_unique ON care_tasks(template_id, resident_id, task_date);

CREATE INDEX idx_care_tasks_care_home ON care_tasks(care_home_id, task_date);
CREATE INDEX idx_care_tasks_resident ON care_tasks(resident_id, task_date);
CREATE INDEX idx_care_tasks_status ON care_tasks(care_home_id, status, task_date);

-- ── TRIGGERS: updated_at auto-update ─────────────────────────────────────

CREATE TRIGGER trg_care_task_templates_updated_at
  BEFORE UPDATE ON care_task_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_care_tasks_updated_at
  BEFORE UPDATE ON care_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
