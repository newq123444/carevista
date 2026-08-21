-- 026_core_care_records.sql
-- Basic records every CQC-registered care home keeps that CareVista had no
-- home for. Each of these is either a statutory requirement or the first thing
-- an inspector asks to see.
--
--  1. healthcare_appointments  - GP, district nurse, chiropody, dentist,
--                                optician, outpatients. Previously nowhere.
--  2. feedback_records         - complaints AND compliments (CQC Reg 16).
--  3. liberty_protections      - DoLS authorisations and every restriction
--                                (bed rails, lap belts, locked doors, covert
--                                medication). Statutory; previously nowhere.
--  4. staff_supervisions       - supervision and appraisal (CQC Reg 18).
--  5. resident_chart_targets   - turns the fluid / food / repositioning fields
--                                already on care_notes into monitored charts
--                                with a target and a shortfall alert.
--  6. resident_finance_ledger  - personal allowance held on a resident's
--                                behalf. Homes are audited on this.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Healthcare appointments and visiting professionals
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS healthcare_appointments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id       UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id        UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  appointment_type   VARCHAR(40) NOT NULL DEFAULT 'gp' CHECK (appointment_type IN (
                       'gp','district_nurse','hospital_outpatient','dentist','optician',
                       'chiropody','physiotherapy','occupational_therapy','speech_language',
                       'mental_health','audiology','tissue_viability','dietitian',
                       'social_worker','other')),
  professional_name  VARCHAR(200),
  organisation       VARCHAR(200),

  scheduled_at       TIMESTAMPTZ NOT NULL,
  location           VARCHAR(50) NOT NULL DEFAULT 'in_home'
                     CHECK (location IN ('in_home','clinic','hospital','video','telephone')),
  reason             TEXT,

  status             VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','attended','did_not_attend','cancelled','rescheduled')),
  escort_required    BOOLEAN NOT NULL DEFAULT FALSE,
  escort_staff_id    UUID REFERENCES users(id),
  transport_notes    TEXT,

  -- filled in afterwards
  outcome            TEXT,
  actions_required   TEXT,
  medication_changed BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up_date     DATE,
  recorded_by        UUID REFERENCES users(id),
  completed_at       TIMESTAMPTZ,

  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hc_appt_home ON healthcare_appointments(care_home_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_hc_appt_resident ON healthcare_appointments(resident_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_hc_appt_upcoming ON healthcare_appointments(care_home_id, status, scheduled_at);


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Complaints, concerns and compliments (CQC Regulation 16)
--    Statutory: acknowledge within 3 working days, respond within 28 days.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_records (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id       UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  reference          VARCHAR(30),

  feedback_type      VARCHAR(20) NOT NULL DEFAULT 'complaint'
                     CHECK (feedback_type IN ('complaint','concern','compliment','suggestion')),
  received_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  received_via       VARCHAR(30) NOT NULL DEFAULT 'verbal'
                     CHECK (received_via IN ('verbal','email','letter','phone','survey','portal','in_person','anonymous')),

  raised_by_name     VARCHAR(200),
  raised_by_relationship VARCHAR(100),
  raised_by_contact  VARCHAR(200),
  anonymous          BOOLEAN NOT NULL DEFAULT FALSE,
  resident_id        UUID REFERENCES residents(id) ON DELETE SET NULL,

  category           VARCHAR(50) CHECK (category IN (
                       'care_quality','staff_conduct','communication','food','environment',
                       'laundry','medication','activities','billing','discrimination',
                       'safeguarding','other')),
  summary            TEXT NOT NULL,
  detail             TEXT,

  severity           VARCHAR(20) NOT NULL DEFAULT 'low'
                     CHECK (severity IN ('low','medium','high')),
  status             VARCHAR(20) NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','investigating','responded','closed','escalated')),

  acknowledged_at    TIMESTAMPTZ,
  acknowledged_by    UUID REFERENCES users(id),
  investigated_by    UUID REFERENCES users(id),
  investigation_notes TEXT,
  response_due       DATE,
  responded_at       TIMESTAMPTZ,
  response_summary   TEXT,

  outcome            VARCHAR(30) CHECK (outcome IN ('upheld','partially_upheld','not_upheld','not_applicable')),
  actions_taken      TEXT,
  lessons_learned    TEXT,
  shared_with_team   BOOLEAN NOT NULL DEFAULT FALSE,

  escalated_to       VARCHAR(100),   -- LGO, CQC, local authority
  cqc_notified       BOOLEAN NOT NULL DEFAULT FALSE,
  safeguarding_raised BOOLEAN NOT NULL DEFAULT FALSE,
  linked_incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,

  closed_at          TIMESTAMPTZ,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_home ON feedback_records(care_home_id, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_records(care_home_id, status);


-- ─────────────────────────────────────────────────────────────────────────
-- 3. DoLS authorisations and the restrictions register
--    Every restriction on a person's liberty must be recorded, justified,
--    least-restrictive, consented to or authorised, and reviewed.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liberty_protections (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id       UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id        UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  record_type        VARCHAR(20) NOT NULL DEFAULT 'restriction'
                     CHECK (record_type IN ('dols','restriction','court_order')),

  -- DoLS authorisation fields
  dols_status        VARCHAR(25) CHECK (dols_status IN (
                       'not_applied','urgent_in_place','standard_applied','granted','expired','refused','withdrawn')),
  applied_date       DATE,
  urgent_expiry      DATE,
  granted_from       DATE,
  granted_until      DATE,
  supervisory_body   VARCHAR(200),
  reference_number   VARCHAR(60),
  conditions         TEXT,
  representative_name VARCHAR(200),   -- RPR
  representative_contact VARCHAR(200),

  -- Restriction fields (bed rails, lap belt, locked door, covert meds, sensor mat)
  restriction_type   VARCHAR(40) CHECK (restriction_type IN (
                       'bed_rails','lap_belt','locked_door','covert_medication','sensor_mat',
                       'door_sensor','restricted_access','supervision_1to1','chemical_restraint',
                       'physical_intervention','financial_control','other')),
  description        TEXT,
  reason             TEXT,
  less_restrictive_considered TEXT,
  consent_basis      VARCHAR(30) CHECK (consent_basis IN (
                       'resident_consent','best_interests','dols_authorised','court_authorised','lpa_consent')),
  capacity_assessment_id UUID,
  authorised_by      VARCHAR(200),
  family_consulted   BOOLEAN NOT NULL DEFAULT FALSE,
  gp_consulted       BOOLEAN NOT NULL DEFAULT FALSE,

  start_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date           DATE,
  review_frequency_days INTEGER NOT NULL DEFAULT 90,
  next_review_date   DATE,
  last_reviewed_at   TIMESTAMPTZ,
  review_notes       TEXT,

  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_liberty_home ON liberty_protections(care_home_id, active);
CREATE INDEX IF NOT EXISTS idx_liberty_resident ON liberty_protections(resident_id, active);
CREATE INDEX IF NOT EXISTS idx_liberty_review ON liberty_protections(care_home_id, next_review_date);


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Staff supervision and appraisal (CQC Regulation 18)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_supervisions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id       UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  staff_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supervisor_id      UUID REFERENCES users(id),

  session_type       VARCHAR(30) NOT NULL DEFAULT 'supervision'
                     CHECK (session_type IN ('supervision','appraisal','probation_review',
                                             'return_to_work','competency_review','disciplinary_support')),
  session_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status             VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','completed','missed','cancelled')),

  what_is_going_well TEXT,
  areas_to_develop   TEXT,
  training_identified TEXT,
  wellbeing_check    TEXT,
  concerns_raised    TEXT,
  agreed_actions     TEXT,
  staff_comments     TEXT,

  staff_signed       BOOLEAN NOT NULL DEFAULT FALSE,
  staff_signed_at    TIMESTAMPTZ,
  supervisor_signed  BOOLEAN NOT NULL DEFAULT FALSE,
  supervisor_signed_at TIMESTAMPTZ,

  next_session_due   DATE,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supervisions_home ON staff_supervisions(care_home_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_supervisions_staff ON staff_supervisions(staff_id, session_date DESC);


-- ─────────────────────────────────────────────────────────────────────────
-- 5. Monitoring targets - turns existing care_notes fields into real charts
--    (no duplicate data entry: staff already record these on a care note)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resident_chart_targets (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id          UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id           UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  monitor_fluids        BOOLEAN NOT NULL DEFAULT FALSE,
  fluid_target_ml       INTEGER,          -- typical adult 1500-2000
  fluid_minimum_ml      INTEGER,          -- alert below this
  monitor_output        BOOLEAN NOT NULL DEFAULT FALSE,

  monitor_food          BOOLEAN NOT NULL DEFAULT FALSE,
  food_minimum_percent  INTEGER,          -- alert if average below

  monitor_repositioning BOOLEAN NOT NULL DEFAULT FALSE,
  reposition_interval_hours INTEGER,      -- e.g. 4

  monitor_weight        BOOLEAN NOT NULL DEFAULT FALSE,
  monitor_bowels        BOOLEAN NOT NULL DEFAULT FALSE,
  bowel_alert_days      INTEGER DEFAULT 3,

  reason                TEXT,
  started_on            DATE NOT NULL DEFAULT CURRENT_DATE,
  review_date           DATE,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  set_by                UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_targets_resident
  ON resident_chart_targets(resident_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_chart_targets_home ON resident_chart_targets(care_home_id, active);


-- ─────────────────────────────────────────────────────────────────────────
-- 6. Resident personal allowance ledger
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resident_finance_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('in','out')),
  amount          DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category        VARCHAR(40) NOT NULL DEFAULT 'other' CHECK (category IN (
                    'deposit','pension','hairdressing','chiropody','newspapers','toiletries',
                    'outings','clothing','transport','refund','withdrawal','other')),
  description     TEXT,
  receipt_url     VARCHAR(500),

  recorded_by     UUID REFERENCES users(id),
  witnessed_by    UUID REFERENCES users(id),
  balance_after   DECIMAL(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_resident ON resident_finance_ledger(resident_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_home ON resident_finance_ledger(care_home_id, entry_date DESC);
