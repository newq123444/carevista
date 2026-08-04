-- ============================================================
-- 013: Resident Quality of Life Features
-- Personal Music Therapy, Personal Menu Choice System,
-- Friendship Mapper, Daily Purpose Planner, Mood-Responsive
-- Environment, Digital Photo Frame Feed, Sleep Quality Tracker,
-- Intergenerational Programme Manager, Rehabilitation Goal
-- Tracker, Birthday & Celebration Planner.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
-- 1. PERSONAL MUSIC THERAPY
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS music_genres (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_music_genres_care_home ON music_genres(care_home_id);

CREATE TABLE IF NOT EXISTS music_preferences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  genre_id        UUID REFERENCES music_genres(id),
  preferred_artists TEXT,
  preferred_era   VARCHAR(50),
  tempo_preference VARCHAR(30),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_music_preferences_care_home ON music_preferences(care_home_id);
CREATE INDEX idx_music_preferences_resident ON music_preferences(resident_id);

CREATE TABLE IF NOT EXISTS music_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  mood_before     INT CHECK (mood_before BETWEEN 1 AND 10),
  mood_after      INT CHECK (mood_after BETWEEN 1 AND 10),
  effectiveness   INT CHECK (effectiveness BETWEEN 1 AND 5),
  notes           TEXT,
  facilitated_by  UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_music_sessions_care_home ON music_sessions(care_home_id);
CREATE INDEX idx_music_sessions_resident ON music_sessions(resident_id);
CREATE INDEX idx_music_sessions_started ON music_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS music_session_songs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES music_sessions(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  artist          VARCHAR(200),
  genre_id        UUID REFERENCES music_genres(id),
  duration_secs   INT,
  resident_response VARCHAR(50),
  play_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_music_session_songs_session ON music_session_songs(session_id);

-- ═══════════════════════════════════════════════════════════════
-- 2. PERSONAL MENU CHOICE SYSTEM
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS menu_options (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  meal_type       VARCHAR(30) NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  photo_url       TEXT,
  texture         VARCHAR(50),
  allergens       JSONB DEFAULT '[]',
  nutritional_info JSONB,
  available_date  DATE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_options_care_home ON menu_options(care_home_id);
CREATE INDEX idx_menu_options_meal_type ON menu_options(care_home_id, meal_type);
CREATE INDEX idx_menu_options_date ON menu_options(care_home_id, available_date);

CREATE TABLE IF NOT EXISTS menu_dietary_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  allergies       JSONB DEFAULT '[]',
  intolerances    JSONB DEFAULT '[]',
  texture_requirement VARCHAR(50),
  cultural_needs  TEXT,
  religious_needs TEXT,
  preferences     TEXT,
  calories_target INT,
  fluid_target_ml INT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_menu_dietary_profiles_resident ON menu_dietary_profiles(care_home_id, resident_id);
CREATE INDEX idx_menu_dietary_profiles_care_home ON menu_dietary_profiles(care_home_id);

CREATE TABLE IF NOT EXISTS menu_choices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  menu_option_id  UUID NOT NULL REFERENCES menu_options(id),
  meal_date       DATE NOT NULL,
  meal_type       VARCHAR(30) NOT NULL,
  portion_size    VARCHAR(20) DEFAULT 'regular',
  special_request TEXT,
  submitted_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_choices_care_home ON menu_choices(care_home_id);
CREATE INDEX idx_menu_choices_resident ON menu_choices(resident_id);
CREATE INDEX idx_menu_choices_date ON menu_choices(care_home_id, meal_date, meal_type);

-- ═══════════════════════════════════════════════════════════════
-- 3. FRIENDSHIP MAPPER
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS friendship_observations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  observed_with   UUID NOT NULL REFERENCES residents(id),
  interaction_type VARCHAR(50) NOT NULL,
  context         TEXT,
  quality_score   INT CHECK (quality_score BETWEEN 1 AND 5),
  observed_by     UUID NOT NULL REFERENCES users(id),
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_friendship_observations_care_home ON friendship_observations(care_home_id);
CREATE INDEX idx_friendship_observations_resident ON friendship_observations(resident_id);
CREATE INDEX idx_friendship_observations_observed_with ON friendship_observations(observed_with);

CREATE TABLE IF NOT EXISTS friendship_connections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_a      UUID NOT NULL REFERENCES residents(id),
  resident_b      UUID NOT NULL REFERENCES residents(id),
  strength        INT NOT NULL DEFAULT 1 CHECK (strength BETWEEN 1 AND 10),
  relationship_type VARCHAR(50),
  notes           TEXT,
  last_interaction TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_friendship_connections_care_home ON friendship_connections(care_home_id);
CREATE INDEX idx_friendship_connections_resident_a ON friendship_connections(resident_a);
CREATE INDEX idx_friendship_connections_resident_b ON friendship_connections(resident_b);

CREATE TABLE IF NOT EXISTS seating_suggestions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  meal_type       VARCHAR(30),
  suggestion      JSONB NOT NULL,
  reason          TEXT,
  accepted        BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seating_suggestions_care_home ON seating_suggestions(care_home_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. DAILY PURPOSE PLANNER
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS purpose_roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  skills_required TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purpose_roles_care_home ON purpose_roles(care_home_id);

CREATE TABLE IF NOT EXISTS purpose_role_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  role_id         UUID NOT NULL REFERENCES purpose_roles(id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','completed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purpose_role_assignments_care_home ON purpose_role_assignments(care_home_id);
CREATE INDEX idx_purpose_role_assignments_resident ON purpose_role_assignments(resident_id);
CREATE INDEX idx_purpose_role_assignments_role ON purpose_role_assignments(role_id);

CREATE TABLE IF NOT EXISTS purpose_engagement_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  assignment_id   UUID NOT NULL REFERENCES purpose_role_assignments(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  engagement_date DATE NOT NULL,
  duration_mins   INT,
  satisfaction    INT CHECK (satisfaction BETWEEN 1 AND 5),
  notes           TEXT,
  logged_by       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purpose_engagement_logs_care_home ON purpose_engagement_logs(care_home_id);
CREATE INDEX idx_purpose_engagement_logs_resident ON purpose_engagement_logs(resident_id);
CREATE INDEX idx_purpose_engagement_logs_assignment ON purpose_engagement_logs(assignment_id);
CREATE INDEX idx_purpose_engagement_logs_date ON purpose_engagement_logs(engagement_date DESC);

-- ═══════════════════════════════════════════════════════════════
-- 5. MOOD-RESPONSIVE ENVIRONMENT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mood_interventions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(50),
  description     TEXT,
  applicable_moods JSONB DEFAULT '[]',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mood_interventions_care_home ON mood_interventions(care_home_id);

CREATE TABLE IF NOT EXISTS mood_intervention_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  intervention_id UUID NOT NULL REFERENCES mood_interventions(id),
  mood_before     INT NOT NULL CHECK (mood_before BETWEEN 1 AND 10),
  mood_after      INT CHECK (mood_after BETWEEN 1 AND 10),
  effectiveness   INT CHECK (effectiveness BETWEEN 1 AND 5),
  notes           TEXT,
  administered_by UUID REFERENCES users(id),
  administered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mood_intervention_history_care_home ON mood_intervention_history(care_home_id);
CREATE INDEX idx_mood_intervention_history_resident ON mood_intervention_history(resident_id);
CREATE INDEX idx_mood_intervention_history_intervention ON mood_intervention_history(intervention_id);
CREATE INDEX idx_mood_intervention_history_date ON mood_intervention_history(administered_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 6. DIGITAL PHOTO FRAME FEED
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS photo_frame_photos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  photo_url       TEXT NOT NULL,
  caption         TEXT,
  uploaded_by_name VARCHAR(200),
  uploaded_by_email VARCHAR(200),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  show_on_date    DATE,
  display_order   INT DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_photo_frame_photos_care_home ON photo_frame_photos(care_home_id);
CREATE INDEX idx_photo_frame_photos_resident ON photo_frame_photos(resident_id);
CREATE INDEX idx_photo_frame_photos_status ON photo_frame_photos(approval_status);
CREATE INDEX idx_photo_frame_photos_show_date ON photo_frame_photos(show_on_date);

CREATE TABLE IF NOT EXISTS photo_frame_viewing_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  photo_id        UUID NOT NULL REFERENCES photo_frame_photos(id) ON DELETE CASCADE,
  resident_id     UUID NOT NULL REFERENCES residents(id),
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reaction        VARCHAR(50),
  notes           TEXT
);

CREATE INDEX idx_photo_frame_viewing_care_home ON photo_frame_viewing_history(care_home_id);
CREATE INDEX idx_photo_frame_viewing_photo ON photo_frame_viewing_history(photo_id);
CREATE INDEX idx_photo_frame_viewing_resident ON photo_frame_viewing_history(resident_id);

-- ═══════════════════════════════════════════════════════════════
-- 7. SLEEP QUALITY TRACKER
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sleep_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  sleep_date      DATE NOT NULL,
  bedtime         TIME,
  wake_time       TIME,
  disturbances    INT DEFAULT 0,
  disturbance_types JSONB DEFAULT '[]',
  interventions   JSONB DEFAULT '[]',
  quality_rating  INT CHECK (quality_rating BETWEEN 1 AND 5),
  total_sleep_hrs DECIMAL(4,2),
  notes           TEXT,
  logged_by       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sleep_logs_care_home ON sleep_logs(care_home_id);
CREATE INDEX idx_sleep_logs_resident ON sleep_logs(resident_id);
CREATE INDEX idx_sleep_logs_date ON sleep_logs(sleep_date DESC);
CREATE INDEX idx_sleep_logs_resident_date ON sleep_logs(resident_id, sleep_date DESC);

CREATE TABLE IF NOT EXISTS sleep_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  avg_bedtime     TIME,
  avg_wake_time   TIME,
  avg_quality     DECIMAL(3,2),
  avg_disturbances DECIMAL(4,2),
  common_disturbances JSONB DEFAULT '[]',
  effective_interventions JSONB DEFAULT '[]',
  analysis_period_days INT DEFAULT 30,
  last_calculated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_sleep_profiles_resident ON sleep_profiles(care_home_id, resident_id);
CREATE INDEX idx_sleep_profiles_care_home ON sleep_profiles(care_home_id);

-- ═══════════════════════════════════════════════════════════════
-- 8. INTERGENERATIONAL PROGRAMME MANAGER
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intergenerational_programmes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  partner_organisation VARCHAR(200),
  age_group       VARCHAR(50),
  frequency       VARCHAR(50),
  safeguarding_requirements JSONB DEFAULT '[]',
  dbs_required    BOOLEAN NOT NULL DEFAULT TRUE,
  risk_assessment TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('planning','active','paused','completed')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intergenerational_programmes_care_home ON intergenerational_programmes(care_home_id);
CREATE INDEX idx_intergenerational_programmes_status ON intergenerational_programmes(status);

CREATE TABLE IF NOT EXISTS intergenerational_visits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  programme_id    UUID NOT NULL REFERENCES intergenerational_programmes(id),
  visit_date      DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  visitor_count   INT,
  activity_description TEXT,
  safeguarding_check_done BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intergenerational_visits_care_home ON intergenerational_visits(care_home_id);
CREATE INDEX idx_intergenerational_visits_programme ON intergenerational_visits(programme_id);
CREATE INDEX idx_intergenerational_visits_date ON intergenerational_visits(visit_date DESC);

CREATE TABLE IF NOT EXISTS intergenerational_participants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  visit_id        UUID NOT NULL REFERENCES intergenerational_visits(id) ON DELETE CASCADE,
  resident_id     UUID NOT NULL REFERENCES residents(id),
  engagement_score INT CHECK (engagement_score BETWEEN 1 AND 5),
  wellbeing_score INT CHECK (wellbeing_score BETWEEN 1 AND 5),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intergenerational_participants_care_home ON intergenerational_participants(care_home_id);
CREATE INDEX idx_intergenerational_participants_visit ON intergenerational_participants(visit_id);
CREATE INDEX idx_intergenerational_participants_resident ON intergenerational_participants(resident_id);

-- ═══════════════════════════════════════════════════════════════
-- 9. REHABILITATION GOAL TRACKER
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rehab_goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  target_date     DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','achieved','paused','discontinued')),
  priority        VARCHAR(20) DEFAULT 'medium',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rehab_goals_care_home ON rehab_goals(care_home_id);
CREATE INDEX idx_rehab_goals_resident ON rehab_goals(resident_id);
CREATE INDEX idx_rehab_goals_status ON rehab_goals(status);

CREATE TABLE IF NOT EXISTS rehab_milestones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  goal_id         UUID NOT NULL REFERENCES rehab_goals(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  target_date     DATE,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  display_order   INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rehab_milestones_care_home ON rehab_milestones(care_home_id);
CREATE INDEX idx_rehab_milestones_goal ON rehab_milestones(goal_id);

CREATE TABLE IF NOT EXISTS rehab_progress_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  goal_id         UUID NOT NULL REFERENCES rehab_goals(id),
  milestone_id    UUID REFERENCES rehab_milestones(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  progress_notes  TEXT,
  score           INT CHECK (score BETWEEN 1 AND 10),
  celebration     BOOLEAN DEFAULT FALSE,
  family_notified BOOLEAN DEFAULT FALSE,
  logged_by       UUID REFERENCES users(id),
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rehab_progress_logs_care_home ON rehab_progress_logs(care_home_id);
CREATE INDEX idx_rehab_progress_logs_goal ON rehab_progress_logs(goal_id);
CREATE INDEX idx_rehab_progress_logs_resident ON rehab_progress_logs(resident_id);
CREATE INDEX idx_rehab_progress_logs_date ON rehab_progress_logs(logged_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 10. BIRTHDAY & CELEBRATION PLANNER
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS celebrations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID REFERENCES residents(id),
  celebration_type VARCHAR(50) NOT NULL
                  CHECK (celebration_type IN ('birthday','admission_anniversary','religious_festival','national_day','personal','other')),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  celebration_date DATE NOT NULL,
  auto_detected   BOOLEAN DEFAULT FALSE,
  status          VARCHAR(20) NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','in_progress','completed','cancelled')),
  budget          DECIMAL(10,2),
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_celebrations_care_home ON celebrations(care_home_id);
CREATE INDEX idx_celebrations_resident ON celebrations(resident_id);
CREATE INDEX idx_celebrations_date ON celebrations(celebration_date);
CREATE INDEX idx_celebrations_type ON celebrations(celebration_type);

CREATE TABLE IF NOT EXISTS celebration_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  celebration_id  UUID NOT NULL REFERENCES celebrations(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  assigned_to     UUID REFERENCES users(id),
  due_date        DATE,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_celebration_tasks_care_home ON celebration_tasks(care_home_id);
CREATE INDEX idx_celebration_tasks_celebration ON celebration_tasks(celebration_id);
CREATE INDEX idx_celebration_tasks_assigned ON celebration_tasks(assigned_to);

CREATE TABLE IF NOT EXISTS celebration_calendar (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  event_name      VARCHAR(200) NOT NULL,
  event_type      VARCHAR(50) NOT NULL,
  event_date      DATE NOT NULL,
  recurring       BOOLEAN DEFAULT FALSE,
  recurrence_rule VARCHAR(100),
  resident_id     UUID REFERENCES residents(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_celebration_calendar_care_home ON celebration_calendar(care_home_id);
CREATE INDEX idx_celebration_calendar_date ON celebration_calendar(event_date);
CREATE INDEX idx_celebration_calendar_resident ON celebration_calendar(resident_id);
