-- ============================================================
-- 012: Batch 3 Mobile, Analytics, Integrations & Training
-- Offline sync queue, resident tablet requests, QR room codes,
-- benchmarking KPIs, board pack reports, staff performance
-- metrics, e-learning modules/quizzes/completions, competency
-- sign-off workflow, diabetes management (glucose, insulin,
-- alerts, HbA1c), and palliative care pathway tables.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Offline Sync Queue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  user_id             UUID NOT NULL REFERENCES users(id),
  entity_type         VARCHAR(50) NOT NULL,
  entity_id           UUID NOT NULL,
  action              VARCHAR(20) NOT NULL
                      CHECK (action IN ('create','update','delete')),
  payload             JSONB,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','synced','conflict')),
  conflict_resolution JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at           TIMESTAMPTZ
);

CREATE INDEX idx_offline_sync_queue_care_home ON offline_sync_queue(care_home_id);
CREATE INDEX idx_offline_sync_queue_user ON offline_sync_queue(user_id);
CREATE INDEX idx_offline_sync_queue_status ON offline_sync_queue(status);
CREATE INDEX idx_offline_sync_queue_created ON offline_sync_queue(created_at DESC);

-- ── Resident Tablet Requests ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resident_tablet_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID NOT NULL REFERENCES residents(id),
  request_type        VARCHAR(50) NOT NULL
                      CHECK (request_type IN ('help','meal_rating','activity_choice','video_call','entertainment')),
  payload             JSONB,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','acknowledged','completed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     UUID REFERENCES users(id)
);

CREATE INDEX idx_resident_tablet_requests_care_home ON resident_tablet_requests(care_home_id);
CREATE INDEX idx_resident_tablet_requests_resident ON resident_tablet_requests(resident_id);
CREATE INDEX idx_resident_tablet_requests_status ON resident_tablet_requests(status);
CREATE INDEX idx_resident_tablet_requests_created ON resident_tablet_requests(created_at DESC);

-- ── QR Room Codes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qr_room_codes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID REFERENCES residents(id),
  room_number         VARCHAR(20) NOT NULL,
  qr_code_data        TEXT NOT NULL,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_qr_room_codes_care_home_room ON qr_room_codes(care_home_id, room_number);
CREATE INDEX idx_qr_room_codes_care_home ON qr_room_codes(care_home_id);
CREATE INDEX idx_qr_room_codes_resident ON qr_room_codes(resident_id);
CREATE INDEX idx_qr_room_codes_active ON qr_room_codes(active);

-- ── Benchmarking KPIs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS benchmarking_kpis (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  metric_name         VARCHAR(100) NOT NULL,
  metric_value        DECIMAL(12,4),
  national_average    DECIMAL(12,4),
  peer_average        DECIMAL(12,4),
  percentile_rank     INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_benchmarking_kpis_care_home_metric_period ON benchmarking_kpis(care_home_id, metric_name, period_start);
CREATE INDEX idx_benchmarking_kpis_care_home ON benchmarking_kpis(care_home_id);
CREATE INDEX idx_benchmarking_kpis_created ON benchmarking_kpis(created_at DESC);

-- ── Board Pack Reports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_pack_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  report_month        DATE NOT NULL,
  title               VARCHAR(200) NOT NULL,
  sections            JSONB,
  status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','final','approved')),
  generated_by        UUID REFERENCES users(id),
  approved_by         UUID REFERENCES users(id),
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at         TIMESTAMPTZ
);

CREATE INDEX idx_board_pack_reports_care_home ON board_pack_reports(care_home_id);
CREATE INDEX idx_board_pack_reports_status ON board_pack_reports(status);
CREATE INDEX idx_board_pack_reports_month ON board_pack_reports(report_month DESC);
CREATE INDEX idx_board_pack_reports_created ON board_pack_reports(generated_at DESC);

-- ── Staff Performance Metrics ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_performance_metrics (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id              UUID NOT NULL REFERENCES care_homes(id),
  staff_id                  UUID NOT NULL REFERENCES users(id),
  period_start              DATE NOT NULL,
  period_end                DATE NOT NULL,
  task_completion_rate      DECIMAL(5,2),
  care_note_quality_score   DECIMAL(5,2),
  avg_response_time_minutes INT,
  training_completion_pct   DECIMAL(5,2),
  notes_count               INT,
  tasks_completed           INT,
  tasks_assigned            INT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_performance_metrics_care_home_staff_period ON staff_performance_metrics(care_home_id, staff_id, period_start);
CREATE INDEX idx_staff_performance_metrics_care_home ON staff_performance_metrics(care_home_id);
CREATE INDEX idx_staff_performance_metrics_staff ON staff_performance_metrics(staff_id);
CREATE INDEX idx_staff_performance_metrics_created ON staff_performance_metrics(created_at DESC);

-- ── E-Learning Modules ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elearning_modules (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  category            VARCHAR(100),
  content_type        VARCHAR(50) NOT NULL
                      CHECK (content_type IN ('video','document','interactive')),
  content_url         TEXT,
  duration_minutes    INT,
  mandatory           BOOLEAN NOT NULL DEFAULT FALSE,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_elearning_modules_care_home ON elearning_modules(care_home_id);
CREATE INDEX idx_elearning_modules_category ON elearning_modules(category);
CREATE INDEX idx_elearning_modules_mandatory ON elearning_modules(mandatory);
CREATE INDEX idx_elearning_modules_created ON elearning_modules(created_at DESC);

-- ── E-Learning Quizzes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elearning_quizzes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id           UUID NOT NULL REFERENCES elearning_modules(id),
  title               VARCHAR(200) NOT NULL,
  questions           JSONB NOT NULL,
  pass_mark_pct       INT NOT NULL DEFAULT 80,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_elearning_quizzes_module ON elearning_quizzes(module_id);
CREATE INDEX idx_elearning_quizzes_created ON elearning_quizzes(created_at DESC);

-- ── E-Learning Completions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elearning_completions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  module_id           UUID NOT NULL REFERENCES elearning_modules(id),
  staff_id            UUID NOT NULL REFERENCES users(id),
  quiz_score          INT,
  passed              BOOLEAN,
  completed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  certificate_id      VARCHAR(100),
  expiry_date         DATE
);

CREATE UNIQUE INDEX idx_elearning_completions_unique ON elearning_completions(module_id, staff_id, completed_at);
CREATE INDEX idx_elearning_completions_care_home ON elearning_completions(care_home_id);
CREATE INDEX idx_elearning_completions_staff ON elearning_completions(staff_id);
CREATE INDEX idx_elearning_completions_module ON elearning_completions(module_id);
CREATE INDEX idx_elearning_completions_created ON elearning_completions(completed_at DESC);

-- ── Competency Sign-Offs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competency_signoffs (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id            UUID NOT NULL REFERENCES care_homes(id),
  staff_id                UUID NOT NULL REFERENCES users(id),
  competency_id           UUID NOT NULL REFERENCES competencies(id),
  assessor_id             UUID NOT NULL REFERENCES users(id),
  observation_date        DATE NOT NULL,
  outcome                 VARCHAR(20) NOT NULL
                          CHECK (outcome IN ('competent','not_yet_competent','requires_training')),
  evidence_notes          TEXT,
  further_training_needed TEXT,
  signed_off              BOOLEAN NOT NULL DEFAULT FALSE,
  signed_off_at           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competency_signoffs_care_home ON competency_signoffs(care_home_id);
CREATE INDEX idx_competency_signoffs_staff ON competency_signoffs(staff_id);
CREATE INDEX idx_competency_signoffs_competency ON competency_signoffs(competency_id);
CREATE INDEX idx_competency_signoffs_assessor ON competency_signoffs(assessor_id);
CREATE INDEX idx_competency_signoffs_created ON competency_signoffs(created_at DESC);

-- ── Glucose Readings (Diabetes Management) ────────────────────────────────
CREATE TABLE IF NOT EXISTS glucose_readings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID NOT NULL REFERENCES residents(id),
  reading_value       DECIMAL(5,1) NOT NULL,
  reading_type        VARCHAR(30) NOT NULL
                      CHECK (reading_type IN ('before_breakfast','after_breakfast','before_lunch','after_lunch','before_dinner','after_dinner','bedtime','random')),
  recorded_by         UUID NOT NULL REFERENCES users(id),
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT
);

CREATE INDEX idx_glucose_readings_care_home ON glucose_readings(care_home_id);
CREATE INDEX idx_glucose_readings_resident ON glucose_readings(resident_id);
CREATE INDEX idx_glucose_readings_recorded_at ON glucose_readings(recorded_at DESC);
CREATE INDEX idx_glucose_readings_created ON glucose_readings(recorded_at DESC);

-- ── Insulin Doses (Diabetes Management) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS insulin_doses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID NOT NULL REFERENCES residents(id),
  insulin_type        VARCHAR(100) NOT NULL,
  dose_units          DECIMAL(5,1) NOT NULL,
  injection_site      VARCHAR(50),
  administered_by     UUID NOT NULL REFERENCES users(id),
  administered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT
);

CREATE INDEX idx_insulin_doses_care_home ON insulin_doses(care_home_id);
CREATE INDEX idx_insulin_doses_resident ON insulin_doses(resident_id);
CREATE INDEX idx_insulin_doses_administered_at ON insulin_doses(administered_at DESC);
CREATE INDEX idx_insulin_doses_created ON insulin_doses(administered_at DESC);

-- ── Diabetes Alerts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diabetes_alerts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID NOT NULL REFERENCES residents(id),
  alert_type          VARCHAR(30) NOT NULL
                      CHECK (alert_type IN ('hypo','hyper')),
  glucose_value       DECIMAL(5,1) NOT NULL,
  triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_by     UUID REFERENCES users(id),
  acknowledged_at     TIMESTAMPTZ,
  actions_taken       TEXT
);

CREATE INDEX idx_diabetes_alerts_care_home ON diabetes_alerts(care_home_id);
CREATE INDEX idx_diabetes_alerts_resident ON diabetes_alerts(resident_id);
CREATE INDEX idx_diabetes_alerts_triggered_at ON diabetes_alerts(triggered_at DESC);
CREATE INDEX idx_diabetes_alerts_created ON diabetes_alerts(triggered_at DESC);

-- ── HbA1c Records (Diabetes Management) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS hba1c_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID NOT NULL REFERENCES residents(id),
  value               DECIMAL(4,1) NOT NULL,
  test_date           DATE NOT NULL,
  recorded_by         UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hba1c_records_care_home ON hba1c_records(care_home_id);
CREATE INDEX idx_hba1c_records_resident ON hba1c_records(resident_id);
CREATE INDEX idx_hba1c_records_test_date ON hba1c_records(test_date DESC);
CREATE INDEX idx_hba1c_records_created ON hba1c_records(created_at DESC);

-- ── Palliative Care Plans ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS palliative_care_plans (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id                UUID NOT NULL REFERENCES care_homes(id),
  resident_id                 UUID NOT NULL REFERENCES residents(id),
  preferred_place_of_death    VARCHAR(100),
  dnacpr_in_place             BOOLEAN,
  advance_decision            BOOLEAN,
  lasting_power_of_attorney   BOOLEAN,
  spiritual_needs             TEXT,
  preferred_priorities        TEXT,
  comfort_measures            TEXT,
  status                      VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','completed','withdrawn')),
  created_by                  UUID NOT NULL REFERENCES users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_palliative_care_plans_care_home ON palliative_care_plans(care_home_id);
CREATE INDEX idx_palliative_care_plans_resident ON palliative_care_plans(resident_id);
CREATE INDEX idx_palliative_care_plans_status ON palliative_care_plans(status);
CREATE INDEX idx_palliative_care_plans_created ON palliative_care_plans(created_at DESC);

-- ── Comfort Rounds (Palliative Care) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS comfort_rounds (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID NOT NULL REFERENCES residents(id),
  scheduled_time      TIMESTAMPTZ NOT NULL,
  completed_time      TIMESTAMPTZ,
  completed_by        UUID REFERENCES users(id),
  pain_score          INT,
  comfort_notes       TEXT,
  repositioned        BOOLEAN,
  fluids_offered      BOOLEAN,
  mouth_care          BOOLEAN
);

CREATE INDEX idx_comfort_rounds_care_home ON comfort_rounds(care_home_id);
CREATE INDEX idx_comfort_rounds_resident ON comfort_rounds(resident_id);
CREATE INDEX idx_comfort_rounds_scheduled ON comfort_rounds(scheduled_time DESC);
CREATE INDEX idx_comfort_rounds_completed_by ON comfort_rounds(completed_by);

-- ── Anticipatory Medications (Palliative Care) ────────────────────────────
CREATE TABLE IF NOT EXISTS anticipatory_medications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID NOT NULL REFERENCES residents(id),
  medication_name     VARCHAR(200) NOT NULL,
  indication          VARCHAR(100),
  dose                VARCHAR(100),
  route               VARCHAR(50),
  location_stored     VARCHAR(100),
  prescribed_by       VARCHAR(200),
  prescribed_date     DATE,
  administered_at     TIMESTAMPTZ,
  administered_by     UUID REFERENCES users(id),
  notes               TEXT
);

CREATE INDEX idx_anticipatory_medications_care_home ON anticipatory_medications(care_home_id);
CREATE INDEX idx_anticipatory_medications_resident ON anticipatory_medications(resident_id);
CREATE INDEX idx_anticipatory_medications_prescribed_date ON anticipatory_medications(prescribed_date DESC);

-- ── Family Communication Log (Palliative Care) ───────────────────────────
CREATE TABLE IF NOT EXISTS family_communication_log (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id            UUID NOT NULL REFERENCES care_homes(id),
  resident_id             UUID NOT NULL REFERENCES residents(id),
  contact_name            VARCHAR(200) NOT NULL,
  contact_relationship    VARCHAR(100),
  communication_type      VARCHAR(50) NOT NULL
                          CHECK (communication_type IN ('phone','in_person','video','email')),
  summary                 TEXT,
  staff_id                UUID NOT NULL REFERENCES users(id),
  communication_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follow_up_needed        BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up_notes         TEXT
);

CREATE INDEX idx_family_communication_log_care_home ON family_communication_log(care_home_id);
CREATE INDEX idx_family_communication_log_resident ON family_communication_log(resident_id);
CREATE INDEX idx_family_communication_log_staff ON family_communication_log(staff_id);
CREATE INDEX idx_family_communication_log_date ON family_communication_log(communication_date DESC);
CREATE INDEX idx_family_communication_log_follow_up ON family_communication_log(follow_up_needed);
