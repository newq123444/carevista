-- 025_care_plans.sql
-- The person-centred care plan: the single most important record in a care
-- home and, until now, the one thing CareVista did not have.
--
-- What existed before: `ai_care_plans` (AI-generated draft narrative, no
-- structure, no review cycle) and `palliative_care_plans` (end-of-life only).
-- Neither satisfies CQC Regulation 9 (person-centred care), which requires an
-- assessed need, a desired outcome, a planned intervention and a review cycle
-- for every domain of a resident's care.
--
-- Design notes:
--  * One live plan per resident, enforced by a partial unique index.
--  * Sections are rows, not JSON, so they can be queried, audited and reported.
--  * Every meaningful edit writes a snapshot into care_plan_versions, because
--    an inspector investigating an incident asks what the plan said *at the
--    time*, not what it says now.
--  * A section can be marked not applicable rather than left blank, so an
--    empty field always means "not yet assessed" - a real safety distinction.

CREATE TABLE IF NOT EXISTS care_plans (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id              UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id               UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  status                    VARCHAR(20) NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','active','under_review','archived')),
  version                   INTEGER NOT NULL DEFAULT 1,
  title                     VARCHAR(200) NOT NULL DEFAULT 'Person-centred care plan',

  -- Person-centred header. This is the part that makes it a care plan for a
  -- person rather than a task list for a body.
  what_matters_to_me        TEXT,
  how_to_support_me_best    TEXT,
  what_upsets_me            TEXT,
  my_routine                TEXT,
  communication_preferences TEXT,
  cultural_spiritual_needs  TEXT,

  -- Involvement and consent (Mental Capacity Act 2005 / CQC Reg 9)
  resident_involved          BOOLEAN NOT NULL DEFAULT FALSE,
  resident_involvement_notes TEXT,
  family_involved            BOOLEAN NOT NULL DEFAULT FALSE,
  family_involvement_notes   TEXT,
  advocate_name              VARCHAR(200),
  capacity_assessment_id     UUID,
  best_interests_decision    TEXT,

  -- Lifecycle
  effective_from            DATE NOT NULL DEFAULT CURRENT_DATE,
  review_frequency_days     INTEGER NOT NULL DEFAULT 30,
  next_review_date          DATE,
  last_reviewed_at          TIMESTAMPTZ,

  -- Sign-off. A care plan without a named clinician behind it is not a plan.
  approved_by               UUID REFERENCES users(id),
  approved_at               TIMESTAMPTZ,
  approved_role             VARCHAR(60),

  archived_at               TIMESTAMPTZ,
  archived_reason           TEXT,
  superseded_by             UUID,

  source_ai_plan_id         UUID,
  created_by                UUID REFERENCES users(id),
  updated_by                UUID REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_plans_home ON care_plans(care_home_id, status);
CREATE INDEX IF NOT EXISTS idx_care_plans_resident ON care_plans(resident_id, status);
CREATE INDEX IF NOT EXISTS idx_care_plans_review_due ON care_plans(care_home_id, next_review_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_plans_one_live
  ON care_plans(resident_id) WHERE status IN ('draft','active','under_review');


CREATE TABLE IF NOT EXISTS care_plan_sections (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_plan_id           UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  care_home_id           UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,

  domain                 VARCHAR(40) NOT NULL CHECK (domain IN (
                           'personal_care','mobility_transfers','nutrition_hydration',
                           'continence','skin_integrity','medication','pain',
                           'breathing_circulation','communication_sensory',
                           'cognition_mental_health','behaviour_support',
                           'social_emotional','night_care','safety_risk','end_of_life')),

  applicable             BOOLEAN NOT NULL DEFAULT TRUE,
  not_applicable_reason  TEXT,

  assessed_need          TEXT,
  desired_outcome        TEXT,
  interventions          TEXT,
  resident_view          TEXT,
  equipment              TEXT,
  staff_required         VARCHAR(100),
  frequency              VARCHAR(150),
  measure_of_success     TEXT,

  risk_level             VARCHAR(20) NOT NULL DEFAULT 'low'
                         CHECK (risk_level IN ('low','medium','high')),
  linked_risk_assessment_id UUID,

  status                 VARCHAR(20) NOT NULL DEFAULT 'not_started'
                         CHECK (status IN ('not_started','in_place','needs_change')),
  sort_order             INTEGER NOT NULL DEFAULT 0,

  updated_by             UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (care_plan_id, domain)
);
CREATE INDEX IF NOT EXISTS idx_care_plan_sections_plan ON care_plan_sections(care_plan_id, sort_order);


CREATE TABLE IF NOT EXISTS care_plan_reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_plan_id      UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  care_home_id      UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id       UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  review_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  review_type       VARCHAR(30) NOT NULL DEFAULT 'routine'
                    CHECK (review_type IN ('routine','change_in_need','post_incident',
                                           'post_hospital','annual','requested')),
  what_is_working     TEXT,
  what_is_not_working TEXT,
  what_changed        TEXT,
  outcome           VARCHAR(20) NOT NULL DEFAULT 'no_change'
                    CHECK (outcome IN ('no_change','updated','escalated')),

  resident_present  BOOLEAN NOT NULL DEFAULT FALSE,
  family_present    BOOLEAN NOT NULL DEFAULT FALSE,
  others_present    TEXT,

  next_review_date  DATE,
  reviewed_by       UUID REFERENCES users(id),
  version_at_review INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_care_plan_reviews_plan ON care_plan_reviews(care_plan_id, review_date DESC);
CREATE INDEX IF NOT EXISTS idx_care_plan_reviews_home ON care_plan_reviews(care_home_id, review_date DESC);


-- Immutable point-in-time snapshots. Never updated, never deleted.
CREATE TABLE IF NOT EXISTS care_plan_versions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_plan_id   UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  care_home_id   UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,
  snapshot       JSONB NOT NULL,
  reason         VARCHAR(200),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_care_plan_versions_plan ON care_plan_versions(care_plan_id, version DESC);

-- Lets the AI writer feed a real plan instead of living beside one.
ALTER TABLE ai_care_plans ADD COLUMN IF NOT EXISTS imported_to_plan_id UUID;
