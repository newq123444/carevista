-- ============================================================
-- 014: Missing Tables and Columns
-- Adds tables referenced by controllers but not yet defined in
-- any migration, and adds missing columns to existing tables.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════════════════════════════
-- NEW TABLES
-- ══════════════════════════════════════════════════════════════

-- ── Admission Referrals ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admission_referrals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  name            VARCHAR(200) NOT NULL,
  date_of_birth   DATE,
  referral_source VARCHAR(200),
  care_needs      JSONB DEFAULT '{}',
  medical_history TEXT,
  mobility        VARCHAR(50),
  behavior        VARCHAR(50),
  preferences     JSONB DEFAULT '{}',
  urgency         VARCHAR(30) DEFAULT 'routine',
  status          VARCHAR(30) DEFAULT 'pending',
  decision_notes  TEXT,
  decided_by      UUID REFERENCES users(id),
  decided_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admission_referrals_care_home ON admission_referrals(care_home_id, created_at DESC);

-- ── Admission Matches ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admission_matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  referral_id     UUID REFERENCES admission_referrals(id),
  overall_score   INT,
  recommendation  VARCHAR(50),
  reasoning       JSONB,
  care_needs      JSONB,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admission_matches_care_home ON admission_matches(care_home_id, created_at DESC);

-- ── AI Care Plans ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_care_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  content         JSONB,
  status          VARCHAR(30) DEFAULT 'draft',
  version         INT DEFAULT 1,
  review_notes    TEXT,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  generated_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_care_plans_care_home ON ai_care_plans(care_home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_care_plans_resident ON ai_care_plans(resident_id);

-- ── Consent Records ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  resident_id       UUID NOT NULL REFERENCES residents(id),
  category          VARCHAR(100),
  description       TEXT,
  consent_given_by  VARCHAR(200),
  relationship      VARCHAR(100),
  review_date       DATE,
  capacity_assessed BOOLEAN DEFAULT FALSE,
  notes             TEXT,
  status            VARCHAR(30) DEFAULT 'active',
  recorded_by       UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_care_home ON consent_records(care_home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_records_resident ON consent_records(resident_id);

-- ── Capacity Assessments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capacity_assessments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  consent_id          UUID REFERENCES consent_records(id),
  has_capacity        BOOLEAN,
  assessment_details  TEXT,
  assessed_by         UUID REFERENCES users(id),
  recorded_by         UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capacity_assessments_care_home ON capacity_assessments(care_home_id, created_at DESC);

-- ── Regulatory Notifications ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regulatory_notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  type            VARCHAR(50),
  resident_id     UUID REFERENCES residents(id),
  incident_id     UUID,
  form_data       JSONB,
  status          VARCHAR(30) DEFAULT 'draft',
  deadline        TIMESTAMPTZ,
  submission_ref  VARCHAR(200),
  submitted_at    TIMESTAMPTZ,
  submitted_by    UUID REFERENCES users(id),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_notifications_care_home ON regulatory_notifications(care_home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regulatory_notifications_status ON regulatory_notifications(status);
CREATE INDEX IF NOT EXISTS idx_regulatory_notifications_deadline ON regulatory_notifications(deadline ASC);

-- ── Smart Handovers ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smart_handovers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  shift_type      VARCHAR(30),
  critical_items  JSONB,
  full_summary    JSONB,
  generated_by    UUID REFERENCES users(id),
  status          VARCHAR(30) DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_handovers_care_home ON smart_handovers(care_home_id, created_at DESC);

-- ── Handover Actions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS handover_actions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  handover_id     UUID REFERENCES smart_handovers(id),
  item_index      INT,
  action_taken    TEXT,
  outcome         TEXT,
  recorded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handover_actions_care_home ON handover_actions(care_home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handover_actions_handover ON handover_actions(handover_id);

-- ── Environmental Readings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS environmental_readings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  zone            VARCHAR(100),
  noise_level     DECIMAL,
  light_level     DECIMAL,
  temperature     DECIMAL,
  humidity        DECIMAL,
  air_quality     DECIMAL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by     UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_environmental_readings_care_home ON environmental_readings(care_home_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_environmental_readings_zone ON environmental_readings(zone, recorded_at DESC);

-- ── CD Register (Controlled Drugs) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS cd_register (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id        UUID NOT NULL REFERENCES care_homes(id),
  resident_id         UUID NOT NULL REFERENCES residents(id),
  medication_name     VARCHAR(200),
  dose                VARCHAR(100),
  quantity            DECIMAL,
  administered_by     UUID REFERENCES users(id),
  witnessed_by        UUID REFERENCES users(id),
  balance             DECIMAL,
  notes               TEXT,
  administration_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cd_register_care_home ON cd_register(care_home_id, administration_time DESC);
CREATE INDEX IF NOT EXISTS idx_cd_register_resident ON cd_register(resident_id);

-- ── Resident Belongings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resident_belongings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  photo_url       VARCHAR(500),
  description     TEXT,
  category        VARCHAR(50) DEFAULT 'general',
  recorded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resident_belongings_care_home ON resident_belongings(care_home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_belongings_resident ON resident_belongings(resident_id);

-- ── Resident Weights ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resident_weights (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  weight_kg       DECIMAL(5,1),
  bmi             DECIMAL(4,1),
  must_score      INT,
  recorded_by     UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resident_weights_care_home ON resident_weights(care_home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_weights_resident ON resident_weights(resident_id);

-- ══════════════════════════════════════════════════════════════
-- ALTER EXISTING TABLES - ADD MISSING COLUMNS
-- ══════════════════════════════════════════════════════════════

-- ── Residents: add missing columns ────────────────────────────────────────
ALTER TABLE residents ADD COLUMN IF NOT EXISTS height_cm DECIMAL(5,1);
ALTER TABLE residents ADD COLUMN IF NOT EXISTS care_type VARCHAR(50);
ALTER TABLE residents ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS dietary_requirements TEXT;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS key_worker_id UUID REFERENCES users(id);
ALTER TABLE residents ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- ── Family Messages: add missing columns ──────────────────────────────────
ALTER TABLE family_messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id);
ALTER TABLE family_messages ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(200);
ALTER TABLE family_messages ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(200);
ALTER TABLE family_messages ADD COLUMN IF NOT EXISTS direction VARCHAR(20) DEFAULT 'outbound';

-- ── Wellbeing Logs: add missing columns ───────────────────────────────────
ALTER TABLE wellbeing_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE wellbeing_logs ADD COLUMN IF NOT EXISTS engagement_level VARCHAR(20);

-- Backfill logged_at from created_at where it is NULL
UPDATE wellbeing_logs SET logged_at = created_at WHERE logged_at IS NULL;
