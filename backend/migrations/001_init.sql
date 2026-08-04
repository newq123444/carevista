-- ============================================================
-- CareVista Database Schema
-- PostgreSQL 16+
-- Run this once on a fresh database, then use migrations for changes
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'super_admin', 'group_admin', 'home_manager', 'deputy_manager',
  'registered_nurse', 'senior_carer', 'carer', 'activities',
  'admin', 'finance', 'family', 'cleaning', 'kitchen', 'maintenance'
);

CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE incident_status AS ENUM ('open', 'review', 'escalated', 'closed');
CREATE TYPE shift_type AS ENUM ('day', 'evening', 'night', 'off', 'annual_leave', 'sick');
CREATE TYPE med_status AS ENUM ('given', 'refused', 'missed', 'omitted', 'not_required');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE funding_type AS ENUM ('self_funded', 'local_authority', 'nhs_continuing', 'mixed');
CREATE TYPE note_type AS ENUM (
  'personal_care', 'nursing_observation', 'nutrition', 'social_wellbeing',
  'incident_note', 'gp_visit', 'hospital_visit', 'family_update',
  'medication_note', 'behaviour', 'sleep', 'repositioning'
);
CREATE TYPE training_status AS ENUM ('current', 'expiring', 'expired', 'booked');
CREATE TYPE ai_operation AS ENUM (
  'family_summary', 'compliance_scan', 'scheduling_suggest',
  'medication_flags', 'care_note_assist'
);

-- ── CARE GROUPS & HOMES ──────────────────────────────────────────────────

CREATE TABLE care_groups (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(200) NOT NULL,
  contact_email VARCHAR(200),
  contact_phone VARCHAR(50),
  address       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE care_homes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID REFERENCES care_groups(id) ON DELETE SET NULL,
  name            VARCHAR(200) NOT NULL,
  address         TEXT NOT NULL,
  postcode        VARCHAR(10),
  phone           VARCHAR(50),
  email           VARCHAR(200),
  registered_beds INTEGER NOT NULL DEFAULT 40,
  cqc_location_id VARCHAR(50),
  cqc_rating      VARCHAR(50) DEFAULT 'Not yet inspected',
  cqc_rated_at    DATE,
  timezone        VARCHAR(50) DEFAULT 'Europe/London',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_care_homes_group ON care_homes(group_id);

-- ── USERS ────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            user_role NOT NULL DEFAULT 'carer',
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(50),
  avatar_url      VARCHAR(500),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login      TIMESTAMPTZ,
  preferences     JSONB DEFAULT '{"theme":"dark","notifications":true}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ -- soft delete
);

CREATE INDEX idx_users_care_home ON users(care_home_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ── STAFF (extends users with HR data) ───────────────────────────────────

CREATE TABLE staff_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  employee_number VARCHAR(50) UNIQUE,
  job_title       VARCHAR(100),
  department      VARCHAR(100),
  start_date      DATE,
  end_date        DATE,
  contract_hours  DECIMAL(5,2), -- e.g. 37.5
  hourly_rate     DECIMAL(8,2),
  dbs_number      VARCHAR(50),
  dbs_expires     DATE,
  dbs_checked_at  DATE,
  nmc_pin         VARCHAR(20), -- for nurses
  address         TEXT,
  emergency_contact_name  VARCHAR(200),
  emergency_contact_phone VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_profiles_care_home ON staff_profiles(care_home_id);
CREATE INDEX idx_staff_profiles_dbs_expires ON staff_profiles(dbs_expires);

-- ── TRAINING RECORDS ─────────────────────────────────────────────────────

CREATE TABLE training_courses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(100),
  validity_months INTEGER NOT NULL DEFAULT 12,
  mandatory       BOOLEAN NOT NULL DEFAULT FALSE,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE training_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  staff_id        UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES training_courses(id),
  course_name     VARCHAR(200) NOT NULL, -- denormalised for flexibility
  provider        VARCHAR(200),
  completed_date  DATE NOT NULL,
  expiry_date     DATE NOT NULL,
  certificate_url VARCHAR(500),
  status          training_status NOT NULL DEFAULT 'current',
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_training_staff ON training_records(staff_id);
CREATE INDEX idx_training_expiry ON training_records(expiry_date);
CREATE INDEX idx_training_care_home ON training_records(care_home_id);

-- ── RESIDENTS ────────────────────────────────────────────────────────────

CREATE TABLE residents (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id          UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100) NOT NULL,
  preferred_name        VARCHAR(100),
  date_of_birth         DATE NOT NULL,
  gender                VARCHAR(20),
  room_number           VARCHAR(20) NOT NULL,
  admission_date        DATE NOT NULL,
  discharge_date        DATE, -- NULL = current resident
  risk_level            risk_level NOT NULL DEFAULT 'low',
  funding_type          funding_type NOT NULL DEFAULT 'self_funded',
  weekly_fee            DECIMAL(8,2),
  gp_name               VARCHAR(200),
  gp_practice           VARCHAR(200),
  gp_phone              VARCHAR(50),
  nhs_number            VARCHAR(20),
  dnacpr                BOOLEAN NOT NULL DEFAULT FALSE,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  photo_url             VARCHAR(500),
  notes                 TEXT,
  care_needs_summary    TEXT,
  religion              VARCHAR(100),
  language              VARCHAR(100) DEFAULT 'English',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_residents_care_home ON residents(care_home_id);
CREATE INDEX idx_residents_active ON residents(care_home_id, active);
CREATE INDEX idx_residents_room ON residents(care_home_id, room_number);

-- ── RESIDENT CONDITIONS ───────────────────────────────────────────────────

CREATE TABLE resident_conditions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  condition   VARCHAR(200) NOT NULL,
  diagnosed   DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resident_conditions ON resident_conditions(resident_id);

-- ── NEXT OF KIN / CONTACTS ────────────────────────────────────────────────

CREATE TABLE resident_contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  relationship    VARCHAR(100),
  phone           VARCHAR(50),
  phone_alt       VARCHAR(50),
  email           VARCHAR(255),
  address         TEXT,
  is_nok          BOOLEAN NOT NULL DEFAULT FALSE, -- next of kin
  is_emergency    BOOLEAN NOT NULL DEFAULT FALSE,
  power_of_attorney BOOLEAN NOT NULL DEFAULT FALSE,
  family_portal_access BOOLEAN NOT NULL DEFAULT FALSE,
  family_portal_user_id UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resident_contacts ON resident_contacts(resident_id);

-- ── CARE NOTES ───────────────────────────────────────────────────────────

CREATE TABLE care_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  author_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note_type       note_type NOT NULL DEFAULT 'personal_care',
  content         TEXT NOT NULL,
  is_significant  BOOLEAN NOT NULL DEFAULT FALSE,
  is_private      BOOLEAN NOT NULL DEFAULT FALSE, -- hidden from family portal
  flagged         BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason     TEXT,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  -- Structured optional fields
  vital_bp_systolic   INTEGER,
  vital_bp_diastolic  INTEGER,
  vital_heart_rate    INTEGER,
  vital_temp          DECIMAL(4,1),
  vital_spo2          INTEGER,
  vital_weight        DECIMAL(5,2),
  pain_score          INTEGER CHECK (pain_score BETWEEN 0 AND 10),
  fluid_intake_ml     INTEGER,
  fluid_output_ml     INTEGER,
  food_eaten_percent  INTEGER CHECK (food_eaten_percent BETWEEN 0 AND 100),
  position            VARCHAR(100), -- for repositioning notes
  mood                VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ -- soft delete
);

CREATE INDEX idx_care_notes_resident ON care_notes(resident_id, created_at DESC);
CREATE INDEX idx_care_notes_care_home ON care_notes(care_home_id, created_at DESC);
CREATE INDEX idx_care_notes_author ON care_notes(author_id);
CREATE INDEX idx_care_notes_type ON care_notes(note_type);
CREATE INDEX idx_care_notes_flagged ON care_notes(care_home_id, flagged) WHERE flagged = TRUE;

-- ── NOTE ATTACHMENTS ─────────────────────────────────────────────────────

CREATE TABLE note_attachments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id     UUID NOT NULL REFERENCES care_notes(id) ON DELETE CASCADE,
  filename    VARCHAR(500) NOT NULL,
  s3_key      VARCHAR(500) NOT NULL,
  mime_type   VARCHAR(100),
  size_bytes  INTEGER,
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_note_attachments ON note_attachments(note_id);

-- ── INCIDENTS ─────────────────────────────────────────────────────────────

CREATE TABLE incidents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  reported_by     UUID NOT NULL REFERENCES users(id),
  incident_type   VARCHAR(100) NOT NULL, -- Fall, Medication, Safeguarding etc.
  severity        incident_severity NOT NULL DEFAULT 'low',
  status          incident_status NOT NULL DEFAULT 'open',
  description     TEXT NOT NULL,
  location        VARCHAR(200),
  witnessed       BOOLEAN NOT NULL DEFAULT FALSE,
  witness_name    VARCHAR(200),
  injuries        TEXT,
  immediate_actions TEXT,
  follow_up       TEXT,
  cqc_reportable  BOOLEAN NOT NULL DEFAULT FALSE,
  reported_to_cqc BOOLEAN NOT NULL DEFAULT FALSE,
  cqc_reported_at TIMESTAMPTZ,
  family_notified BOOLEAN NOT NULL DEFAULT FALSE,
  family_notified_at TIMESTAMPTZ,
  gp_notified     BOOLEAN NOT NULL DEFAULT FALSE,
  gp_notified_at  TIMESTAMPTZ,
  closed_by       UUID REFERENCES users(id),
  closed_at       TIMESTAMPTZ,
  incident_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_care_home ON incidents(care_home_id, incident_date DESC);
CREATE INDEX idx_incidents_resident ON incidents(resident_id);
CREATE INDEX idx_incidents_status ON incidents(care_home_id, status);
CREATE INDEX idx_incidents_severity ON incidents(care_home_id, severity);

CREATE TABLE incident_updates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  status_change incident_status,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── MEDICATIONS ───────────────────────────────────────────────────────────

CREATE TABLE medications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  name            VARCHAR(200) NOT NULL,
  generic_name    VARCHAR(200),
  dose            VARCHAR(100) NOT NULL,
  route           VARCHAR(100) NOT NULL DEFAULT 'Oral',
  frequency       VARCHAR(200), -- e.g. "Twice daily"
  administration_times TEXT[] NOT NULL DEFAULT '{}', -- e.g. {"08:00","22:00"}
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,
  prescribed_by   VARCHAR(200),
  indication      TEXT,
  special_instructions TEXT,
  is_prn          BOOLEAN NOT NULL DEFAULT FALSE, -- as needed
  is_controlled   BOOLEAN NOT NULL DEFAULT FALSE,
  quantity_in_stock INTEGER,
  reorder_level   INTEGER DEFAULT 7,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medications_resident ON medications(resident_id);
CREATE INDEX idx_medications_care_home ON medications(care_home_id, active);

-- ── MEDICATION ADMINISTRATION (eMAR) ─────────────────────────────────────

CREATE TABLE med_administrations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  medication_id   UUID NOT NULL REFERENCES medications(id) ON DELETE RESTRICT,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  administered_by UUID NOT NULL REFERENCES users(id),
  witnessed_by    UUID REFERENCES users(id),
  administration_date DATE NOT NULL,
  scheduled_time  TIME NOT NULL,
  actual_time     TIME,
  status          med_status NOT NULL,
  dose_given      VARCHAR(100),
  notes           TEXT,
  refusal_reason  TEXT,
  omission_reason TEXT,
  -- For PRN medications
  prn_reason      TEXT,
  prn_effect      TEXT,
  is_prn          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: one admin record per med per date per scheduled time (prevents duplicates)
CREATE UNIQUE INDEX idx_med_admin_unique ON med_administrations(medication_id, administration_date, scheduled_time);
CREATE INDEX idx_med_admin_resident ON med_administrations(resident_id, administration_date DESC);
CREATE INDEX idx_med_admin_care_home ON med_administrations(care_home_id, administration_date DESC);
CREATE INDEX idx_med_admin_status ON med_administrations(care_home_id, status) WHERE status IN ('missed', 'refused');

-- ── SHIFTS & ROTA ─────────────────────────────────────────────────────────

CREATE TABLE shifts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  staff_id        UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
  shift_date      DATE NOT NULL,
  shift_type      shift_type NOT NULL DEFAULT 'day',
  start_time      TIME,
  end_time        TIME,
  break_minutes   INTEGER DEFAULT 30,
  role_on_shift   VARCHAR(100), -- can differ from main role
  notes           TEXT,
  confirmed       BOOLEAN NOT NULL DEFAULT FALSE,
  is_agency       BOOLEAN NOT NULL DEFAULT FALSE,
  agency_name     VARCHAR(200),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_shifts_unique ON shifts(staff_id, shift_date);
CREATE INDEX idx_shifts_care_home ON shifts(care_home_id, shift_date);
CREATE INDEX idx_shifts_staff ON shifts(staff_id, shift_date DESC);

-- ── COMPLIANCE / CQC ──────────────────────────────────────────────────────

CREATE TYPE kloe_domain AS ENUM ('safe', 'effective', 'caring', 'responsive', 'well_led');

CREATE TABLE compliance_actions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  description     TEXT,
  kloe_domain     kloe_domain NOT NULL,
  priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
  due_date        DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  assigned_to     UUID REFERENCES users(id),
  evidence_notes  TEXT,
  completed_by    UUID REFERENCES users(id),
  completed_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_care_home ON compliance_actions(care_home_id, status);

CREATE TABLE policies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  title           VARCHAR(300) NOT NULL,
  version         VARCHAR(20),
  category        VARCHAR(100),
  content         TEXT,
  s3_key          VARCHAR(500),
  review_date     DATE,
  status          VARCHAR(50) DEFAULT 'current',
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policies_care_home ON policies(care_home_id);

-- ── FAMILY PORTAL ─────────────────────────────────────────────────────────

CREATE TABLE family_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  from_user_id    UUID REFERENCES users(id), -- NULL = from family
  to_user_id      UUID REFERENCES users(id), -- NULL = to family
  from_name       VARCHAR(200) NOT NULL,
  subject         VARCHAR(500),
  body            TEXT NOT NULL,
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  parent_id       UUID REFERENCES family_messages(id), -- threading
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_messages_care_home ON family_messages(care_home_id, created_at DESC);
CREATE INDEX idx_family_messages_resident ON family_messages(resident_id);
CREATE INDEX idx_family_messages_unread ON family_messages(care_home_id, read) WHERE read = FALSE;

-- ── INVOICES / BILLING ────────────────────────────────────────────────────

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  invoice_number  VARCHAR(50) NOT NULL UNIQUE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  period_label    VARCHAR(50), -- e.g. "March 2026"
  amount_pence    INTEGER NOT NULL, -- store in pence to avoid float errors
  vat_pence       INTEGER NOT NULL DEFAULT 0,
  total_pence     INTEGER NOT NULL,
  payer_name      VARCHAR(200),
  payer_type      funding_type,
  payer_reference VARCHAR(200), -- LA reference etc.
  status          invoice_status NOT NULL DEFAULT 'draft',
  due_date        DATE,
  paid_date       DATE,
  payment_reference VARCHAR(200),
  notes           TEXT,
  pdf_s3_key      VARCHAR(500),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_care_home ON invoices(care_home_id, period_start DESC);
CREATE INDEX idx_invoices_resident ON invoices(resident_id);
CREATE INDEX idx_invoices_status ON invoices(care_home_id, status);

-- ── AI AUDIT LOG ──────────────────────────────────────────────────────────

CREATE TABLE ai_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  requested_by    UUID NOT NULL REFERENCES users(id),
  operation       ai_operation NOT NULL,
  input_context   JSONB, -- what data was sent (no raw PII if avoidable)
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  output_summary  TEXT,
  model_used      VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'success',
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_audit_care_home ON ai_audit_log(care_home_id, created_at DESC);
CREATE INDEX idx_ai_audit_user ON ai_audit_log(requested_by);

-- ── AUDIT LOG (all data mutations) ───────────────────────────────────────

CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY, -- use bigint for high volume
  care_home_id    UUID NOT NULL,
  actor_id        UUID,
  actor_name      VARCHAR(200),
  action          VARCHAR(100) NOT NULL, -- e.g. MED_ADMIN_RECORDED
  entity_type     VARCHAR(100), -- e.g. medication, resident
  entity_id       UUID,
  before_data     JSONB,
  after_data      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_care_home ON audit_log(care_home_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
-- Partition by month in production for scale

-- ── REFRESH TOKENS ────────────────────────────────────────────────────────

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ── TRIGGERS: updated_at auto-update ─────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'care_groups','care_homes','users','staff_profiles','training_records',
    'residents','care_notes','incidents','medications','shifts',
    'compliance_actions','policies','invoices'
  ]
  LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl, tbl);
  END LOOP;
END
$$;

-- ── SEED: Default training courses ────────────────────────────────────────

INSERT INTO training_courses (name, category, validity_months, mandatory) VALUES
  ('Safeguarding Adults', 'Safeguarding', 36, TRUE),
  ('Safeguarding Children', 'Safeguarding', 36, TRUE),
  ('Moving & Handling', 'Physical Care', 12, TRUE),
  ('Fire Safety', 'Health & Safety', 12, TRUE),
  ('Infection Prevention & Control', 'Health & Safety', 12, TRUE),
  ('Basic Life Support / CPR', 'Emergency', 12, TRUE),
  ('First Aid', 'Emergency', 36, FALSE),
  ('Dementia Awareness', 'Clinical', 36, FALSE),
  ('Mental Capacity Act', 'Legal', 36, TRUE),
  ('Deprivation of Liberty Safeguards (DoLS)', 'Legal', 36, TRUE),
  ('Medication Administration', 'Clinical', 12, FALSE),
  ('Food Hygiene', 'Health & Safety', 36, TRUE),
  ('GDPR & Data Protection', 'Compliance', 24, TRUE),
  ('Equality & Diversity', 'HR', 36, TRUE),
  ('Whistleblowing', 'HR', 36, TRUE),
  ('Pressure Area Care', 'Clinical', 24, FALSE),
  ('Dysphagia Awareness', 'Clinical', 24, FALSE),
  ('End of Life Care', 'Clinical', 24, FALSE);
