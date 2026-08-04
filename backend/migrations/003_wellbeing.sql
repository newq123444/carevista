-- 003_wellbeing.sql — Wellbeing, Life Story, Social Isolation, Environment Preferences
-- ============================================================

-- (a) Wellbeing Logs — daily mood/pain/sleep/engagement tracking
CREATE TABLE IF NOT EXISTS wellbeing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  logged_by UUID NOT NULL REFERENCES users(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood VARCHAR(20) CHECK (mood IN ('very_happy','happy','neutral','low','very_low')),
  pain_level INT CHECK (pain_level >= 0 AND pain_level <= 10),
  sleep_quality VARCHAR(20) CHECK (sleep_quality IN ('excellent','good','fair','poor','very_poor')),
  social_engagement VARCHAR(20) CHECK (social_engagement IN ('high','moderate','low','isolated')),
  appetite VARCHAR(20) CHECK (appetite IN ('excellent','good','fair','poor','refused')),
  energy_level VARCHAR(20) CHECK (energy_level IN ('high','moderate','low','very_low')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wellbeing_logs_resident ON wellbeing_logs(resident_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_wellbeing_logs_care_home ON wellbeing_logs(care_home_id, log_date DESC);

-- (b) Resident Life Story — rich biographical details
CREATE TABLE IF NOT EXISTS resident_life_story (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL UNIQUE REFERENCES residents(id),
  occupation VARCHAR(255),
  hometown VARCHAR(255),
  spouse_info TEXT,
  children_info TEXT,
  pets TEXT,
  hobbies TEXT[],
  favorite_music TEXT[],
  favorite_tv TEXT[],
  favorite_foods TEXT[],
  conversation_topics TEXT[],
  comfort_items TEXT[],
  daily_routine_preferences TEXT,
  religious_preferences TEXT,
  dislikes TEXT[],
  important_dates JSONB,
  life_achievements TEXT,
  war_service TEXT,
  personality_traits TEXT[],
  communication_style TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- (c) Social Isolation Alerts
CREATE TABLE IF NOT EXISTS social_isolation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  alert_type VARCHAR(30) CHECK (alert_type IN ('no_visitors','no_activities','no_social_notes','low_engagement')),
  days_since_last INT,
  severity VARCHAR(20) CHECK (severity IN ('mild','moderate','severe')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','acknowledged','resolved')),
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_isolation_alerts_status ON social_isolation_alerts(care_home_id, status);

-- (d) Environment Preferences
CREATE TABLE IF NOT EXISTS environment_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL UNIQUE REFERENCES residents(id),
  preferred_lighting VARCHAR(50),
  preferred_temperature VARCHAR(50),
  preferred_music_volume VARCHAR(50),
  calming_sounds TEXT[],
  aromatherapy TEXT[],
  room_decorations TEXT,
  photo_display_preference TEXT,
  tv_volume VARCHAR(50),
  noise_sensitivity VARCHAR(20) CHECK (noise_sensitivity IN ('low','moderate','high')),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
