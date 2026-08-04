-- ============================================================
-- 010: Batch 1 Clinical Features
-- NEWS2 vitals scoring, wound photography tracking, infection
-- outbreak tracking, continence assessment, smart rota builder,
-- natural language search, automated risk assessments, and
-- medication interaction checker.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── NEWS2 Assessments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news2_assessments (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id            UUID NOT NULL REFERENCES care_homes(id),
  resident_id             UUID NOT NULL REFERENCES residents(id),
  assessed_by             UUID NOT NULL REFERENCES users(id),
  respiratory_rate        INT,
  spo2                    INT,
  supplemental_oxygen     BOOLEAN DEFAULT FALSE,
  systolic_bp             INT,
  pulse                   INT,
  consciousness           VARCHAR(20)
                          CHECK (consciousness IN ('alert','confusion','voice','pain','unresponsive')),
  temperature             DECIMAL(4,1),
  total_score             INT NOT NULL,
  risk_level              VARCHAR(20)
                          CHECK (risk_level IN ('low','medium','high','critical')),
  escalation_action       TEXT,
  escalation_triggered_at TIMESTAMPTZ,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news2_assessments_care_home ON news2_assessments(care_home_id);
CREATE INDEX idx_news2_assessments_resident ON news2_assessments(resident_id);
CREATE INDEX idx_news2_assessments_created ON news2_assessments(created_at DESC);
CREATE INDEX idx_news2_assessments_risk_level ON news2_assessments(risk_level);

-- ── NEWS2 Escalations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news2_escalations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  assessment_id     UUID NOT NULL REFERENCES news2_assessments(id),
  resident_id       UUID NOT NULL REFERENCES residents(id),
  escalation_level  VARCHAR(20)
                    CHECK (escalation_level IN ('low','medium','high','critical')),
  action_taken      TEXT,
  responded_by      UUID REFERENCES users(id),
  responded_at      TIMESTAMPTZ,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','acknowledged','resolved')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news2_escalations_care_home ON news2_escalations(care_home_id);
CREATE INDEX idx_news2_escalations_resident ON news2_escalations(resident_id);
CREATE INDEX idx_news2_escalations_status ON news2_escalations(status);
CREATE INDEX idx_news2_escalations_created ON news2_escalations(created_at DESC);

-- ── Wound Assessments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wound_assessments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  resident_id       UUID NOT NULL REFERENCES residents(id),
  assessed_by       UUID NOT NULL REFERENCES users(id),
  wound_type        VARCHAR(50),
  location_body_area VARCHAR(100),
  location_x        DECIMAL(5,2),
  location_y        DECIMAL(5,2),
  width_mm          DECIMAL(6,1),
  height_mm         DECIMAL(6,1),
  depth_mm          DECIMAL(6,1),
  wound_bed         VARCHAR(50),
  exudate_level     VARCHAR(20),
  exudate_type      VARCHAR(50),
  surrounding_skin  VARCHAR(100),
  pain_level        INT CHECK (pain_level >= 0 AND pain_level <= 10),
  photo_url         TEXT,
  notes             TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','healing','healed','worsening')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wound_assessments_care_home ON wound_assessments(care_home_id);
CREATE INDEX idx_wound_assessments_resident ON wound_assessments(resident_id);
CREATE INDEX idx_wound_assessments_status ON wound_assessments(status);
CREATE INDEX idx_wound_assessments_created ON wound_assessments(created_at DESC);

-- ── Infection Outbreaks ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS infection_outbreaks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  outbreak_type       VARCHAR(50) NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','contained','resolved')),
  affected_count      INT DEFAULT 0,
  isolation_protocol  TEXT,
  notes               TEXT,
  reported_by         UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_infection_outbreaks_care_home ON infection_outbreaks(care_home_id);
CREATE INDEX idx_infection_outbreaks_status ON infection_outbreaks(status);
CREATE INDEX idx_infection_outbreaks_created ON infection_outbreaks(created_at DESC);

-- ── Infection Cases ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS infection_cases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  outbreak_id     UUID NOT NULL REFERENCES infection_outbreaks(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  symptoms        TEXT,
  onset_date      DATE NOT NULL,
  isolation_start DATE,
  isolation_end   DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','recovering','resolved','deceased')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_infection_cases_care_home ON infection_cases(care_home_id);
CREATE INDEX idx_infection_cases_outbreak ON infection_cases(outbreak_id);
CREATE INDEX idx_infection_cases_resident ON infection_cases(resident_id);
CREATE INDEX idx_infection_cases_status ON infection_cases(status);
CREATE INDEX idx_infection_cases_created ON infection_cases(created_at DESC);

-- ── Continence Logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS continence_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID NOT NULL REFERENCES care_homes(id),
  resident_id   UUID NOT NULL REFERENCES residents(id),
  logged_by     UUID NOT NULL REFERENCES users(id),
  event_type    VARCHAR(30)
                CHECK (event_type IN ('continent','incontinent_urine','incontinent_faeces','incontinent_both','pad_change','toileted_successfully','toileted_unsuccessfully')),
  event_time    TIMESTAMPTZ NOT NULL,
  pad_status    VARCHAR(20)
                CHECK (pad_status IN ('dry','wet','soiled','not_applicable')),
  location      VARCHAR(100),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_continence_logs_care_home ON continence_logs(care_home_id);
CREATE INDEX idx_continence_logs_resident ON continence_logs(resident_id);
CREATE INDEX idx_continence_logs_created ON continence_logs(created_at DESC);

-- ── Continence Assessments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS continence_assessments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id          UUID NOT NULL REFERENCES care_homes(id),
  resident_id           UUID NOT NULL REFERENCES residents(id),
  assessed_by           UUID NOT NULL REFERENCES users(id),
  pattern_analysis      JSONB,
  recommended_schedule  JSONB,
  pad_type              VARCHAR(50),
  current_pad_usage     INT,
  target_pad_usage      INT,
  dignity_notes         TEXT,
  review_date           DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_continence_assessments_care_home ON continence_assessments(care_home_id);
CREATE INDEX idx_continence_assessments_resident ON continence_assessments(resident_id);
CREATE INDEX idx_continence_assessments_created ON continence_assessments(created_at DESC);

-- ── Rota Templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rota_templates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  name              VARCHAR(200) NOT NULL,
  week_start        DATE NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  constraints       JSONB DEFAULT '{}',
  budget_limit_pence INT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rota_templates_care_home ON rota_templates(care_home_id);
CREATE INDEX idx_rota_templates_status ON rota_templates(status);
CREATE INDEX idx_rota_templates_created ON rota_templates(created_at DESC);

-- ── Rota Shifts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rota_shifts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  template_id     UUID NOT NULL REFERENCES rota_templates(id),
  staff_id        UUID NOT NULL REFERENCES users(id),
  shift_date      DATE NOT NULL,
  shift_type      VARCHAR(20) NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  role_required   VARCHAR(50),
  auto_generated  BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rota_shifts_care_home ON rota_shifts(care_home_id);
CREATE INDEX idx_rota_shifts_template ON rota_shifts(template_id);
CREATE INDEX idx_rota_shifts_staff ON rota_shifts(staff_id);
CREATE INDEX idx_rota_shifts_date ON rota_shifts(shift_date);
CREATE INDEX idx_rota_shifts_created ON rota_shifts(created_at DESC);

-- ── Natural Language Search Queries ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS nl_search_queries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID NOT NULL REFERENCES care_homes(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  query_text    TEXT NOT NULL,
  parsed_intent JSONB,
  results_count INT DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nl_search_queries_care_home ON nl_search_queries(care_home_id);
CREATE INDEX idx_nl_search_queries_user ON nl_search_queries(user_id);
CREATE INDEX idx_nl_search_queries_created ON nl_search_queries(created_at DESC);

-- ── Risk Assessments (Waterlow/MUST/Falls) ────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_assessments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  resident_id       UUID NOT NULL REFERENCES residents(id),
  assessed_by       UUID NOT NULL REFERENCES users(id),
  assessment_type   VARCHAR(30) NOT NULL
                    CHECK (assessment_type IN ('waterlow','must','falls')),
  total_score       INT NOT NULL,
  risk_level        VARCHAR(20) NOT NULL
                    CHECK (risk_level IN ('low','medium','high','very_high')),
  factors           JSONB NOT NULL DEFAULT '{}',
  auto_populated    BOOLEAN DEFAULT FALSE,
  next_review_date  DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'current'
                    CHECK (status IN ('current','overdue','superseded')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_assessments_care_home ON risk_assessments(care_home_id);
CREATE INDEX idx_risk_assessments_resident ON risk_assessments(resident_id);
CREATE INDEX idx_risk_assessments_type ON risk_assessments(assessment_type);
CREATE INDEX idx_risk_assessments_status ON risk_assessments(status);
CREATE INDEX idx_risk_assessments_created ON risk_assessments(created_at DESC);

-- ── Medication Interactions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_interactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  resident_id       UUID NOT NULL REFERENCES residents(id),
  medication_a_id   UUID NOT NULL REFERENCES medications(id),
  medication_b_id   UUID NOT NULL REFERENCES medications(id),
  interaction_type  VARCHAR(50),
  severity          VARCHAR(20) NOT NULL
                    CHECK (severity IN ('minor','moderate','major','contraindicated')),
  description       TEXT,
  clinical_effect   TEXT,
  recommendation    TEXT,
  flagged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_by   UUID REFERENCES users(id),
  acknowledged_at   TIMESTAMPTZ,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','acknowledged','resolved','overridden')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medication_interactions_care_home ON medication_interactions(care_home_id);
CREATE INDEX idx_medication_interactions_resident ON medication_interactions(resident_id);
CREATE INDEX idx_medication_interactions_severity ON medication_interactions(severity);
CREATE INDEX idx_medication_interactions_status ON medication_interactions(status);
CREATE INDEX idx_medication_interactions_created ON medication_interactions(created_at DESC);
