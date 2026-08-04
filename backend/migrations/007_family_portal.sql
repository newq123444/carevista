-- 007_family_portal.sql
-- Family Portal Enhancement: daily summaries, weekly reports, photo gallery

-- (a) Family Daily Summaries
CREATE TABLE family_daily_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  summary_date DATE NOT NULL,
  meals_summary TEXT,
  activities_summary TEXT,
  mood_summary TEXT,
  care_notes_summary TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by VARCHAR(20) DEFAULT 'ai',
  UNIQUE (resident_id, summary_date)
);

CREATE INDEX idx_family_daily_summaries_care_home_resident
  ON family_daily_summaries (care_home_id, resident_id);

-- (b) Family Weekly Reports
CREATE TABLE family_weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  report_content TEXT,
  wellbeing_score_avg DECIMAL(3,1),
  highlights TEXT[] DEFAULT '{}',
  concerns TEXT[] DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  sent_to_emails TEXT[] DEFAULT '{}',
  UNIQUE (resident_id, week_start)
);

CREATE INDEX idx_family_weekly_reports_care_home
  ON family_weekly_reports (care_home_id);

-- (c) Family Photo Gallery
CREATE TABLE family_photo_gallery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  photo_url VARCHAR(500) NOT NULL,
  caption TEXT,
  activity_session_id UUID REFERENCES activity_sessions(id),
  uploaded_by UUID REFERENCES users(id),
  visibility VARCHAR(20) DEFAULT 'family',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_photo_gallery_resident_care_home
  ON family_photo_gallery (resident_id, care_home_id);
