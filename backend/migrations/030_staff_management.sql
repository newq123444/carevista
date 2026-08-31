-- 030_staff_management.sql
--
-- Three gaps in managing a team:
--
--  1. A leaver's login stayed live for ever. There was no way to deactivate
--     anyone — only to edit their job title. A carer who left in March could
--     still sign in in September. That is a safeguarding and data-security
--     problem as much as a missing feature, so the leaver flow is the first
--     thing here.
--
--  2. Nothing recorded when somebody cannot work. Rotas were built blind, and
--     in a sector with high turnover, repeatedly rostering a carer on the day
--     they collect their children is how you lose them.
--
--  3. Right to work was never recorded at all, which every UK employer must
--     hold and every inspector asks for.

-- ── Leavers and employment compliance ──────────────────────────────────────
-- end_date already exists on staff_profiles; these say why and evidence the
-- checks an employer is required to keep.
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS leaving_reason        VARCHAR(60);
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS leaving_notes         TEXT;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS deactivated_by        UUID REFERENCES users(id);
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS right_to_work_checked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS right_to_work_expires DATE;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS reference_count       INTEGER;

-- ── Working preferences: one row per member of staff ───────────────────────
CREATE TABLE IF NOT EXISTS staff_preferences (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id             UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  staff_id                 UUID NOT NULL UNIQUE REFERENCES staff_profiles(id) ON DELETE CASCADE,

  preferred_shifts         TEXT[] NOT NULL DEFAULT '{}',   -- day / evening / night
  avoid_shifts             TEXT[] NOT NULL DEFAULT '{}',

  max_hours_per_week       DECIMAL(5,2),
  max_consecutive_days     INTEGER,
  min_hours_between_shifts INTEGER DEFAULT 11,   -- Working Time Regulations default

  wants_more_hours         BOOLEAN NOT NULL DEFAULT FALSE,
  can_do_overtime          BOOLEAN NOT NULL DEFAULT TRUE,
  works_alone_ok           BOOLEAN NOT NULL DEFAULT TRUE,

  notes                    TEXT,
  updated_by               UUID REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_prefs_home ON staff_preferences(care_home_id);

-- ── When somebody cannot, or would rather not, work ────────────────────────
-- Either a recurring weekday ("never Tuesdays") or a date range ("away 3–17
-- August"). The CHECK makes sure a row says one or the other.
CREATE TABLE IF NOT EXISTS staff_unavailability (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  staff_id      UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,

  kind          VARCHAR(24) NOT NULL DEFAULT 'unavailable'
                CHECK (kind IN ('unavailable','prefer_not','annual_leave','training',
                                'fixed_commitment','parental','medical')),
  weekday       INTEGER CHECK (weekday BETWEEN 0 AND 6),   -- 0 = Sunday
  from_date     DATE,
  to_date       DATE,
  from_time     TIME,
  to_time       TIME,

  reason        TEXT,
  approved      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT staff_unavailability_when
    CHECK (weekday IS NOT NULL OR from_date IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_staff_unavail_staff ON staff_unavailability(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_unavail_dates ON staff_unavailability(care_home_id, from_date, to_date);
