-- Migration 002: Activities scheduling with mobility-based filtering
-- Adds activities, activity_sessions, activity_participants tables
-- and extends residents with mobility_status, interests, wellbeing_score

-- Activities library
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  activity_type VARCHAR(50) NOT NULL DEFAULT 'social',
  required_mobility_level VARCHAR(30) NOT NULL DEFAULT 'any'
    CHECK (required_mobility_level IN ('any','walking_aid_or_better','wheelchair_or_better','independent_only')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_participants INTEGER DEFAULT 12,
  location VARCHAR(255),
  facilitator VARCHAR(255),
  recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(50),
  category VARCHAR(50) NOT NULL DEFAULT 'social',
  sensory_friendly BOOLEAN DEFAULT FALSE,
  cognitive_level VARCHAR(30) DEFAULT 'any'
    CHECK (cognitive_level IN ('any','mild','moderate','high')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity sessions (scheduled instances)
CREATE TABLE IF NOT EXISTS activity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  facilitator_id UUID REFERENCES users(id),
  notes TEXT,
  mood_rating_avg DECIMAL(3,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity participants
CREATE TABLE IF NOT EXISTS activity_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES activity_sessions(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  attendance VARCHAR(20) NOT NULL DEFAULT 'registered'
    CHECK (attendance IN ('registered','attended','declined','unable')),
  engagement_level VARCHAR(10) DEFAULT NULL
    CHECK (engagement_level IN ('high','medium','low','none', NULL)),
  mood_before VARCHAR(20),
  mood_after VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, resident_id)
);

-- Extend residents with mobility, interests, wellbeing
ALTER TABLE residents ADD COLUMN IF NOT EXISTS mobility_status VARCHAR(30) DEFAULT 'independent'
  CHECK (mobility_status IN ('independent','walking_aid','wheelchair','bed_bound'));

ALTER TABLE residents ADD COLUMN IF NOT EXISTS interests TEXT[];

ALTER TABLE residents ADD COLUMN IF NOT EXISTS wellbeing_score INTEGER DEFAULT 7
  CHECK (wellbeing_score >= 0 AND wellbeing_score <= 10);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_care_home ON activities(care_home_id);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_date ON activity_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_activity ON activity_sessions(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_session ON activity_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_resident ON activity_participants(resident_id);
CREATE INDEX IF NOT EXISTS idx_residents_mobility ON residents(mobility_status);
