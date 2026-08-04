-- ============================================================
-- 011: Batch 2 Finance, HR & Facilities Features
-- Automated invoicing enhancements, occupancy forecasting,
-- staff cost analytics, digital recruitment pipeline,
-- competency matrix, sickness/absence analytics, fire log book,
-- visitor sign-in, room turnover, and custom report builder.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Rate Uplifts (Automated Invoicing Enhancements) ───────────────────────
CREATE TABLE IF NOT EXISTS rate_uplifts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  resident_id       UUID NOT NULL REFERENCES residents(id),
  previous_rate_pence INT NOT NULL,
  new_rate_pence    INT NOT NULL,
  effective_date    DATE NOT NULL,
  reason            TEXT,
  approved_by       UUID REFERENCES users(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','applied')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_uplifts_care_home ON rate_uplifts(care_home_id);
CREATE INDEX idx_rate_uplifts_resident ON rate_uplifts(resident_id);
CREATE INDEX idx_rate_uplifts_status ON rate_uplifts(status);
CREATE INDEX idx_rate_uplifts_created ON rate_uplifts(created_at DESC);

-- ── Payment Reminders ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_reminders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  invoice_id        UUID NOT NULL,
  reminder_type     VARCHAR(30) NOT NULL,
  sent_at           TIMESTAMPTZ,
  channel           VARCHAR(20)
                    CHECK (channel IN ('email','sms','letter','phone')),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','failed','cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_reminders_care_home ON payment_reminders(care_home_id);
CREATE INDEX idx_payment_reminders_invoice ON payment_reminders(invoice_id);
CREATE INDEX idx_payment_reminders_status ON payment_reminders(status);
CREATE INDEX idx_payment_reminders_created ON payment_reminders(created_at DESC);

-- ── Revenue Dashboard Cache ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_dashboard_cache (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  cache_date        DATE NOT NULL,
  total_revenue_pence INT,
  outstanding_pence INT,
  overdue_pence     INT,
  occupancy_pct     DECIMAL(5,2),
  avg_rate_pence    INT,
  data_payload      JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_dashboard_cache_care_home ON revenue_dashboard_cache(care_home_id);
CREATE INDEX idx_revenue_dashboard_cache_date ON revenue_dashboard_cache(cache_date DESC);

-- ── Occupancy Records ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS occupancy_records (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id          UUID NOT NULL REFERENCES care_homes(id),
  record_date           DATE NOT NULL,
  total_beds            INT NOT NULL,
  occupied_beds         INT NOT NULL,
  occupancy_pct         DECIMAL(5,2),
  revenue_per_bed_pence INT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_occupancy_records_care_home ON occupancy_records(care_home_id);
CREATE INDEX idx_occupancy_records_date ON occupancy_records(record_date DESC);
CREATE INDEX idx_occupancy_records_created ON occupancy_records(created_at DESC);

-- ── Occupancy Forecasts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS occupancy_forecasts (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id            UUID NOT NULL REFERENCES care_homes(id),
  forecast_date           DATE NOT NULL,
  predicted_occupancy_pct DECIMAL(5,2),
  predicted_vacancies     INT,
  revenue_impact_pence    INT,
  confidence_level        DECIMAL(4,3),
  suggested_actions       JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_occupancy_forecasts_care_home ON occupancy_forecasts(care_home_id);
CREATE INDEX idx_occupancy_forecasts_date ON occupancy_forecasts(forecast_date);
CREATE INDEX idx_occupancy_forecasts_created ON occupancy_forecasts(created_at DESC);

-- ── Staff Costs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_costs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  staff_id            UUID NOT NULL REFERENCES users(id),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  basic_hours         DECIMAL(6,2),
  overtime_hours      DECIMAL(6,2),
  basic_cost_pence    INT,
  overtime_cost_pence INT,
  agency_cost_pence   INT DEFAULT 0,
  is_agency           BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_costs_care_home ON staff_costs(care_home_id);
CREATE INDEX idx_staff_costs_staff ON staff_costs(staff_id);
CREATE INDEX idx_staff_costs_period ON staff_costs(period_start, period_end);
CREATE INDEX idx_staff_costs_created ON staff_costs(created_at DESC);

-- ── Cost Budgets ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_budgets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  budget_month    DATE NOT NULL,
  budget_pence    INT NOT NULL,
  actual_pence    INT DEFAULT 0,
  variance_pence  INT DEFAULT 0,
  category        VARCHAR(50) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_budgets_care_home ON cost_budgets(care_home_id);
CREATE INDEX idx_cost_budgets_month ON cost_budgets(budget_month);
CREATE INDEX idx_cost_budgets_category ON cost_budgets(category);
CREATE INDEX idx_cost_budgets_created ON cost_budgets(created_at DESC);

-- ── Job Postings (Digital Recruitment Pipeline) ───────────────────────────
CREATE TABLE IF NOT EXISTS job_postings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  title           VARCHAR(200) NOT NULL,
  department      VARCHAR(100),
  contract_type   VARCHAR(30),
  hours_per_week  DECIMAL(4,1),
  salary_range    VARCHAR(100),
  description     TEXT,
  requirements    TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','closed','filled')),
  posted_at       TIMESTAMPTZ,
  closes_at       TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_postings_care_home ON job_postings(care_home_id);
CREATE INDEX idx_job_postings_status ON job_postings(status);
CREATE INDEX idx_job_postings_created ON job_postings(created_at DESC);

-- ── Job Applications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_applications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  job_posting_id  UUID NOT NULL REFERENCES job_postings(id),
  applicant_name  VARCHAR(200) NOT NULL,
  applicant_email VARCHAR(200),
  applicant_phone VARCHAR(50),
  cv_url          TEXT,
  cover_letter    TEXT,
  stage           VARCHAR(20) NOT NULL DEFAULT 'applied'
                  CHECK (stage IN ('applied','screening','interview','offer','hired','rejected')),
  notes           TEXT,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_applications_care_home ON job_applications(care_home_id);
CREATE INDEX idx_job_applications_posting ON job_applications(job_posting_id);
CREATE INDEX idx_job_applications_stage ON job_applications(stage);
CREATE INDEX idx_job_applications_created ON job_applications(created_at DESC);

-- ── Interviews ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  application_id  UUID NOT NULL REFERENCES job_applications(id),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  interviewers    JSONB,
  location        VARCHAR(200),
  notes           TEXT,
  outcome         VARCHAR(20) DEFAULT 'pending'
                  CHECK (outcome IN ('pending','pass','fail')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interviews_care_home ON interviews(care_home_id);
CREATE INDEX idx_interviews_application ON interviews(application_id);
CREATE INDEX idx_interviews_scheduled ON interviews(scheduled_at);
CREATE INDEX idx_interviews_created ON interviews(created_at DESC);

-- ── DBS Checks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dbs_checks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  application_id      UUID,
  staff_id            UUID,
  person_name         VARCHAR(200) NOT NULL,
  dbs_type            VARCHAR(30),
  certificate_number  VARCHAR(50),
  issue_date          DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','clear','flagged','expired')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dbs_checks_care_home ON dbs_checks(care_home_id);
CREATE INDEX idx_dbs_checks_application ON dbs_checks(application_id);
CREATE INDEX idx_dbs_checks_staff ON dbs_checks(staff_id);
CREATE INDEX idx_dbs_checks_status ON dbs_checks(status);
CREATE INDEX idx_dbs_checks_created ON dbs_checks(created_at DESC);

-- ── Competencies (Competency Matrix) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS competencies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(100),
  description     TEXT,
  requires_renewal BOOLEAN DEFAULT FALSE,
  renewal_months  INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competencies_care_home ON competencies(care_home_id);
CREATE INDEX idx_competencies_category ON competencies(category);
CREATE INDEX idx_competencies_created ON competencies(created_at DESC);

-- ── Staff Competencies ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_competencies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  staff_id        UUID NOT NULL REFERENCES users(id),
  competency_id   UUID NOT NULL REFERENCES competencies(id),
  signed_off_by   UUID REFERENCES users(id),
  signed_off_date DATE,
  expiry_date     DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('competent','expired','in_training','not_started')),
  evidence_notes  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_competencies_care_home ON staff_competencies(care_home_id);
CREATE INDEX idx_staff_competencies_staff ON staff_competencies(staff_id);
CREATE INDEX idx_staff_competencies_competency ON staff_competencies(competency_id);
CREATE INDEX idx_staff_competencies_status ON staff_competencies(status);
CREATE INDEX idx_staff_competencies_created ON staff_competencies(created_at DESC);

-- ── Absence Records (Sickness/Absence Analytics) ──────────────────────────
CREATE TABLE IF NOT EXISTS absence_records (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id              UUID NOT NULL REFERENCES care_homes(id),
  staff_id                  UUID NOT NULL REFERENCES users(id),
  absence_type              VARCHAR(30) NOT NULL,
  start_date                DATE NOT NULL,
  end_date                  DATE,
  total_days                DECIMAL(5,1),
  reason                    TEXT,
  self_certified            BOOLEAN DEFAULT FALSE,
  fit_note_received         BOOLEAN DEFAULT FALSE,
  return_to_work_date       DATE,
  return_to_work_completed  BOOLEAN DEFAULT FALSE,
  return_to_work_notes      TEXT,
  created_by                UUID REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_absence_records_care_home ON absence_records(care_home_id);
CREATE INDEX idx_absence_records_staff ON absence_records(staff_id);
CREATE INDEX idx_absence_records_dates ON absence_records(start_date, end_date);
CREATE INDEX idx_absence_records_created ON absence_records(created_at DESC);

-- ── Bradford Scores ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bradford_scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  staff_id        UUID NOT NULL REFERENCES users(id),
  calculated_date DATE NOT NULL,
  score           INT NOT NULL,
  spells          INT NOT NULL,
  total_days      INT NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bradford_scores_care_home ON bradford_scores(care_home_id);
CREATE INDEX idx_bradford_scores_staff ON bradford_scores(staff_id);
CREATE INDEX idx_bradford_scores_date ON bradford_scores(calculated_date DESC);
CREATE INDEX idx_bradford_scores_created ON bradford_scores(created_at DESC);

-- ── Fire Tests (Fire Log Book) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_tests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  test_type           VARCHAR(30) NOT NULL
                      CHECK (test_type IN ('weekly_alarm','quarterly_drill','annual_evacuation')),
  test_date           DATE NOT NULL,
  time_taken_seconds  INT,
  all_clear           BOOLEAN DEFAULT TRUE,
  issues_found        TEXT,
  conducted_by        UUID REFERENCES users(id),
  witnesses           JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fire_tests_care_home ON fire_tests(care_home_id);
CREATE INDEX idx_fire_tests_type ON fire_tests(test_type);
CREATE INDEX idx_fire_tests_date ON fire_tests(test_date DESC);
CREATE INDEX idx_fire_tests_created ON fire_tests(created_at DESC);

-- ── Fire Drills ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_drills (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  drill_date          DATE NOT NULL,
  drill_type          VARCHAR(30) NOT NULL,
  evacuation_time_seconds INT,
  residents_evacuated INT,
  staff_participated  INT,
  issues_identified   TEXT,
  corrective_actions  TEXT,
  conducted_by        UUID REFERENCES users(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fire_drills_care_home ON fire_drills(care_home_id);
CREATE INDEX idx_fire_drills_date ON fire_drills(drill_date DESC);
CREATE INDEX idx_fire_drills_created ON fire_drills(created_at DESC);

-- ── Fire Equipment Checks ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_equipment_checks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  equipment_type  VARCHAR(50) NOT NULL,
  location        VARCHAR(200),
  check_date      DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pass'
                  CHECK (status IN ('pass','fail','needs_attention')),
  next_check_date DATE,
  checked_by      UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fire_equipment_checks_care_home ON fire_equipment_checks(care_home_id);
CREATE INDEX idx_fire_equipment_checks_status ON fire_equipment_checks(status);
CREATE INDEX idx_fire_equipment_checks_date ON fire_equipment_checks(check_date DESC);
CREATE INDEX idx_fire_equipment_checks_created ON fire_equipment_checks(created_at DESC);

-- ── PEEPs (Personal Emergency Evacuation Plans) ───────────────────────────
CREATE TABLE IF NOT EXISTS peeps (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID NOT NULL REFERENCES residents(id),
  mobility_status     VARCHAR(50),
  evacuation_method   VARCHAR(100),
  assistance_required TEXT,
  equipment_needed    TEXT,
  primary_helper      UUID REFERENCES users(id),
  secondary_helper    UUID REFERENCES users(id),
  review_date         DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'current'
                      CHECK (status IN ('current','needs_review','archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_peeps_care_home ON peeps(care_home_id);
CREATE INDEX idx_peeps_resident ON peeps(resident_id);
CREATE INDEX idx_peeps_status ON peeps(status);
CREATE INDEX idx_peeps_created ON peeps(created_at DESC);

-- ── Visitor Records (Visitor Sign-In) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS visitor_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  visitor_name        VARCHAR(200) NOT NULL,
  visitor_type        VARCHAR(20) NOT NULL
                      CHECK (visitor_type IN ('family','friend','contractor','professional','other')),
  company             VARCHAR(200),
  visiting_resident_id UUID REFERENCES residents(id),
  purpose             TEXT,
  sign_in_time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sign_out_time       TIMESTAMPTZ,
  badge_number        VARCHAR(20),
  car_registration    VARCHAR(20),
  dbs_verified        BOOLEAN DEFAULT FALSE,
  safeguarding_flag   BOOLEAN DEFAULT FALSE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visitor_records_care_home ON visitor_records(care_home_id);
CREATE INDEX idx_visitor_records_type ON visitor_records(visitor_type);
CREATE INDEX idx_visitor_records_sign_in ON visitor_records(sign_in_time DESC);
CREATE INDEX idx_visitor_records_created ON visitor_records(created_at DESC);

-- ── Visitor Safeguarding ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visitor_safeguarding (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  visitor_name        VARCHAR(200) NOT NULL,
  visitor_type        VARCHAR(50),
  restriction_type    VARCHAR(50),
  reason              TEXT,
  restricted_residents JSONB,
  active              BOOLEAN DEFAULT TRUE,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visitor_safeguarding_care_home ON visitor_safeguarding(care_home_id);
CREATE INDEX idx_visitor_safeguarding_active ON visitor_safeguarding(active);
CREATE INDEX idx_visitor_safeguarding_created ON visitor_safeguarding(created_at DESC);

-- ── Room Turnovers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_turnovers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  room_number         VARCHAR(20) NOT NULL,
  previous_resident_id UUID REFERENCES residents(id),
  vacated_date        DATE NOT NULL,
  target_ready_date   DATE,
  actual_ready_date   DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'vacated'
                      CHECK (status IN ('vacated','in_progress','ready','allocated')),
  assigned_to         UUID REFERENCES users(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_room_turnovers_care_home ON room_turnovers(care_home_id);
CREATE INDEX idx_room_turnovers_status ON room_turnovers(status);
CREATE INDEX idx_room_turnovers_created ON room_turnovers(created_at DESC);

-- ── Turnover Checklist Items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS turnover_checklist_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  turnover_id     UUID NOT NULL REFERENCES room_turnovers(id),
  task_name       VARCHAR(200) NOT NULL,
  category        VARCHAR(20) NOT NULL
                  CHECK (category IN ('cleaning','maintenance','decoration','inventory','admin')),
  completed       BOOLEAN DEFAULT FALSE,
  completed_by    UUID REFERENCES users(id),
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_turnover_checklist_care_home ON turnover_checklist_items(care_home_id);
CREATE INDEX idx_turnover_checklist_turnover ON turnover_checklist_items(turnover_id);
CREATE INDEX idx_turnover_checklist_category ON turnover_checklist_items(category);
CREATE INDEX idx_turnover_checklist_created ON turnover_checklist_items(created_at DESC);

-- ── Report Templates (Custom Report Builder) ──────────────────────────────
CREATE TABLE IF NOT EXISTS report_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  data_source     VARCHAR(100),
  fields          JSONB,
  filters         JSONB,
  group_by        JSONB,
  sort_by         JSONB,
  schedule_cron   VARCHAR(100),
  format          VARCHAR(10) NOT NULL DEFAULT 'pdf'
                  CHECK (format IN ('pdf','csv','excel','json')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_templates_care_home ON report_templates(care_home_id);
CREATE INDEX idx_report_templates_created ON report_templates(created_at DESC);

-- ── Report Runs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  template_id     UUID NOT NULL REFERENCES report_templates(id),
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parameters      JSONB,
  row_count       INT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed')),
  result_url      TEXT,
  error           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_runs_care_home ON report_runs(care_home_id);
CREATE INDEX idx_report_runs_template ON report_runs(template_id);
CREATE INDEX idx_report_runs_status ON report_runs(status);
CREATE INDEX idx_report_runs_created ON report_runs(created_at DESC);
