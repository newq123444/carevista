-- ============================================================
-- 006: Predictive Care Engine tables
-- ============================================================

-- ── PREDICTIVE RISK SCORES ────────────────────────────────────────────────

CREATE TABLE predictive_risk_scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  risk_type       VARCHAR(30) NOT NULL,
  score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  factors         JSONB,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictive_risk_scores_care_home ON predictive_risk_scores(care_home_id);
CREATE INDEX idx_predictive_risk_scores_resident ON predictive_risk_scores(resident_id);

-- ── PREDICTIVE ALERTS ─────────────────────────────────────────────────────

CREATE TABLE predictive_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id),
  resident_id     UUID NOT NULL REFERENCES residents(id),
  alert_type      VARCHAR(50) NOT NULL,
  risk_score      INTEGER NOT NULL,
  threshold       INTEGER NOT NULL DEFAULT 70,
  factors         JSONB,
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','acknowledged','resolved')),
  acknowledged_by UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictive_alerts_care_home ON predictive_alerts(care_home_id);
CREATE INDEX idx_predictive_alerts_resident ON predictive_alerts(resident_id);
