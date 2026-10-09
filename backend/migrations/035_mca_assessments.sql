-- ───────────────────────────────────────────────────────────────────────────
-- 035_mca_assessments.sql
--
-- Mental Capacity Act 2005 assessments, decision by decision.
--
-- The old capacity_assessments table held a yes/no and a text box against a
-- consent record. That cannot show the two-stage test, the support given, the
-- evidence for each limb, the causal link, or a best interests decision — so
-- it cannot show the assessment was lawful. This replaces it for new work; the
-- old table is left in place so nothing already recorded is lost.
--
-- Shape: the columns that are searched and reported on are real columns; the
-- full structured record is JSONB, validated by services/mcaEngine.ts before
-- completion. The engine, not the database, is the authority on what a
-- compliant assessment contains.
--
-- A completed assessment is FINAL. It can be superseded by a review, never
-- edited. That is enforced here, not just in the application, because a
-- capacity finding that can be quietly rewritten after the fact is worthless
-- to a court, an inspector or the person it is about.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mca_assessments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  decision        TEXT NOT NULL,
  category        VARCHAR(40) NOT NULL DEFAULT 'other',
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  outcome         VARCHAR(30),
  record          JSONB NOT NULL DEFAULT '{}',

  review_date     DATE,
  deprivation_of_liberty BOOLEAN NOT NULL DEFAULT FALSE,

  supersedes_id   UUID REFERENCES mca_assessments(id) ON DELETE RESTRICT,

  assessor_id     UUID REFERENCES users(id) ON DELETE RESTRICT,
  assessor_name   VARCHAR(200),
  assessor_role   VARCHAR(40),
  completed_at    TIMESTAMPTZ,

  created_by      UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT mca_status_valid CHECK (status IN ('draft', 'completed', 'superseded')),
  CONSTRAINT mca_outcome_valid CHECK (outcome IS NULL OR outcome IN ('has_capacity', 'lacks_capacity', 'cannot_determine')),
  CONSTRAINT mca_completed_has_outcome CHECK (status = 'draft' OR (outcome IS NOT NULL AND completed_at IS NOT NULL AND assessor_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_mca_resident ON mca_assessments(care_home_id, resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mca_review   ON mca_assessments(care_home_id, review_date) WHERE status = 'completed';

-- Completed assessments are final. The only permitted change is to mark one
-- as superseded by a later review — and nothing else on the row may move.
CREATE OR REPLACE FUNCTION mca_completed_is_final() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'A completed capacity assessment cannot be deleted'
        USING HINT = 'Start a review instead; the original stays on the record.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'completed' AND NEW.status = 'superseded'
     AND ROW(NEW.id, NEW.care_home_id, NEW.resident_id, NEW.decision, NEW.category,
             NEW.outcome, NEW.record, NEW.review_date, NEW.deprivation_of_liberty,
             NEW.supersedes_id, NEW.assessor_id, NEW.assessor_name, NEW.assessor_role,
             NEW.completed_at, NEW.created_by, NEW.created_at)
       IS NOT DISTINCT FROM
         ROW(OLD.id, OLD.care_home_id, OLD.resident_id, OLD.decision, OLD.category,
             OLD.outcome, OLD.record, OLD.review_date, OLD.deprivation_of_liberty,
             OLD.supersedes_id, OLD.assessor_id, OLD.assessor_name, OLD.assessor_role,
             OLD.completed_at, OLD.created_by, OLD.created_at)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'A completed capacity assessment is final and cannot be changed'
    USING HINT = 'Start a review instead; the original stays on the record.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mca_completed_is_final ON mca_assessments;
CREATE TRIGGER trg_mca_completed_is_final
  BEFORE UPDATE OR DELETE ON mca_assessments
  FOR EACH ROW EXECUTE FUNCTION mca_completed_is_final();

COMMENT ON TABLE mca_assessments IS
  'Decision-specific Mental Capacity Act 2005 assessments. Completed rows are final; '
  'a review creates a new row that supersedes the old.';
