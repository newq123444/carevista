-- 008_cqc_compliance.sql
-- CQC Compliance Automation: domain scores, evidence packs, policy reviews, inspection checklists

-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- (a) CQC Domain Scores
CREATE TABLE IF NOT EXISTS cqc_domain_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id),
  domain VARCHAR(20) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  evidence_count INTEGER DEFAULT 0,
  gaps_count INTEGER DEFAULT 0,
  strengths JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cqc_domain_scores_home_domain_calc
  ON cqc_domain_scores (care_home_id, domain, calculated_at DESC);

-- (b) CQC Evidence Packs
CREATE TABLE IF NOT EXISTS cqc_evidence_packs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id),
  generated_by UUID REFERENCES users(id),
  domains_included TEXT[] NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  content JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating','complete','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cqc_evidence_packs_home
  ON cqc_evidence_packs (care_home_id);

-- (c) Policy Reviews
CREATE TABLE IF NOT EXISTS policy_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id),
  policy_id UUID NOT NULL REFERENCES policies(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_review_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'reviewed',
  changes_made TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_reviews_home_policy
  ON policy_reviews (care_home_id, policy_id);

-- (d) Inspection Prep Checklists
CREATE TABLE IF NOT EXISTS inspection_prep_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id UUID NOT NULL REFERENCES care_homes(id),
  title VARCHAR(300) NOT NULL,
  domain VARCHAR(20) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  completed_items INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_prep_checklists_home_domain
  ON inspection_prep_checklists (care_home_id, domain);
