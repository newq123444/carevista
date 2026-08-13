-- 024_resident_absences.sql
-- A resident in hospital (or on home leave) is still a resident: their bed is
-- held and their record continues. Previously the only states were "active"
-- (so care tasks kept generating for an empty bed) or "discharged" (which loses
-- them entirely). This adds a temporary-absence state.

CREATE TABLE IF NOT EXISTS resident_absences (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id       UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  absence_type      VARCHAR(30) NOT NULL DEFAULT 'hospital'
                    CHECK (absence_type IN ('hospital','home_leave','respite_elsewhere','other')),
  start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return   DATE,
  actual_return     DATE,
  reason            TEXT,
  destination       VARCHAR(200),
  planned           BOOLEAN NOT NULL DEFAULT FALSE,
  return_notes      TEXT,
  recorded_by       UUID REFERENCES users(id),
  returned_by       UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resident_absences_home ON resident_absences(care_home_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_resident_absences_resident ON resident_absences(resident_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_absences_open
  ON resident_absences(resident_id) WHERE actual_return IS NULL;
