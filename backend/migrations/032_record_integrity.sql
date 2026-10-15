-- ───────────────────────────────────────────────────────────────────────────
-- 032_record_integrity.sql
--
-- Tamper-evident care records, and detection of records that are implausible
-- on their face.
--
-- See compliance/RECORD_INTEGRITY_THREAT_MODEL.md for what this does and, just
-- as importantly, what it does not do.
-- ───────────────────────────────────────────────────────────────────────────

-- ── The chain ──────────────────────────────────────────────────────────────
-- One append-only chain per care home. Each entry commits to the one before
-- it, so altering any historic record breaks every hash after it.

CREATE TABLE IF NOT EXISTS record_chain (
  id              BIGSERIAL PRIMARY KEY,
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,

  -- Position within this home's chain. Gaps mean deletion; both are detected.
  seq             BIGINT NOT NULL,

  -- What was recorded.
  entity_type     VARCHAR(60) NOT NULL,   -- care_note | med_administration | care_task | finding_resolution
  entity_id       UUID NOT NULL,
  action          VARCHAR(40) NOT NULL DEFAULT 'created',

  -- The digest of the record's meaningful fields, and the exact field list it
  -- was taken over. Storing the field list means adding a column in a later
  -- migration cannot invalidate entries written before that column existed.
  entry_hash      CHAR(64) NOT NULL,
  hashed_fields   TEXT[] NOT NULL,
  digest_version  SMALLINT NOT NULL DEFAULT 1,

  prev_hash       CHAR(64) NOT NULL,
  chain_hash      CHAR(64) NOT NULL,

  -- Who and when, as the server saw it. recorded_at is when the entry was
  -- appended; event_at is when the care being described actually happened.
  -- The gap between them is one of the things the detector looks at.
  recorded_by     UUID REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_at        TIMESTAMPTZ,

  anchored_in     BIGINT,   -- FK added after chain_anchors exists

  CONSTRAINT record_chain_seq_unique UNIQUE (care_home_id, seq),
  CONSTRAINT record_chain_hash_hex CHECK (entry_hash ~ '^[0-9a-f]{64}$'
                                      AND prev_hash  ~ '^[0-9a-f]{64}$'
                                      AND chain_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_chain_home_seq   ON record_chain(care_home_id, seq);
CREATE INDEX IF NOT EXISTS idx_chain_entity     ON record_chain(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_chain_unanchored ON record_chain(care_home_id, recorded_at)
  WHERE anchored_in IS NULL;

-- The chain is append-only. UPDATE and DELETE are refused at the database
-- level, not merely avoided in application code — the whole point is that the
-- application cannot quietly rewrite history, and neither can anyone using the
-- same credentials it uses.
CREATE OR REPLACE FUNCTION record_chain_is_append_only() RETURNS TRIGGER AS $$
BEGIN
  -- DELETE is handled first and on its own. NEW does not exist for a DELETE,
  -- and PL/pgSQL does not guarantee short-circuit evaluation of AND, so a
  -- combined condition that mentions NEW could fault here instead of raising
  -- the intended error.
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'record_chain is append-only: DELETE refused'
      USING HINT = 'A care record chain that can be edited proves nothing.';
  END IF;

  -- Anchoring stamps a batch of rows. That is the one permitted mutation, and
  -- only from NULL, so an anchor can never be reassigned.
  --
  -- IS NOT DISTINCT FROM, not =. Row equality with = yields NULL when any
  -- element is NULL, and recorded_by and event_at are both nullable — so an
  -- ordinary anchoring update on a row with a NULL event_at would fall through
  -- to the exception and anchoring would never work.
  IF OLD.anchored_in IS NULL
     AND NEW.anchored_in IS NOT NULL
     AND ROW(NEW.id, NEW.care_home_id, NEW.seq, NEW.entity_type, NEW.entity_id,
             NEW.action, NEW.entry_hash, NEW.hashed_fields, NEW.digest_version,
             NEW.prev_hash, NEW.chain_hash,
             NEW.recorded_by, NEW.recorded_at, NEW.event_at)
       IS NOT DISTINCT FROM
         ROW(OLD.id, OLD.care_home_id, OLD.seq, OLD.entity_type, OLD.entity_id,
             OLD.action, OLD.entry_hash, OLD.hashed_fields, OLD.digest_version,
             OLD.prev_hash, OLD.chain_hash,
             OLD.recorded_by, OLD.recorded_at, OLD.event_at)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'record_chain is append-only: UPDATE refused'
    USING HINT = 'Only the anchored_in stamp may be set, and only once.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_record_chain_append_only ON record_chain;
CREATE TRIGGER trg_record_chain_append_only
  BEFORE UPDATE OR DELETE ON record_chain
  FOR EACH ROW EXECUTE FUNCTION record_chain_is_append_only();

-- ── Daily anchors ──────────────────────────────────────────────────────────
-- A Merkle root over each day's entries. A root, rather than just the chain
-- head, so that one record can be proved to a third party without disclosing
-- any other resident's records.

CREATE TABLE IF NOT EXISTS chain_anchors (
  id              BIGSERIAL PRIMARY KEY,
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  anchor_date     DATE NOT NULL,
  from_seq        BIGINT NOT NULL,
  to_seq          BIGINT NOT NULL,
  entry_count     INTEGER NOT NULL,
  merkle_root     CHAR(64) NOT NULL,
  chain_head      CHAR(64) NOT NULL,

  -- How strong this anchor actually is. 'local' means the root is stored only
  -- in the database it protects, which does NOT defend against someone with
  -- database write access. The interface must say so rather than implying the
  -- stronger property. 'external' means it was published to an independent
  -- party and the receipt is stored below.
  anchor_mode     VARCHAR(20) NOT NULL DEFAULT 'local'
                  CHECK (anchor_mode IN ('local', 'external')),
  external_provider  VARCHAR(80),
  external_ref       TEXT,
  external_receipt   BYTEA,
  published_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chain_anchors_day_unique UNIQUE (care_home_id, anchor_date),
  CONSTRAINT chain_anchors_range CHECK (to_seq >= from_seq),
  CONSTRAINT chain_anchors_external_has_ref
    CHECK (anchor_mode = 'local' OR (external_provider IS NOT NULL AND published_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_anchors_home_date ON chain_anchors(care_home_id, anchor_date DESC);

ALTER TABLE record_chain
  DROP CONSTRAINT IF EXISTS record_chain_anchor_fk;
ALTER TABLE record_chain
  ADD CONSTRAINT record_chain_anchor_fk
  FOREIGN KEY (anchored_in) REFERENCES chain_anchors(id) ON DELETE RESTRICT;

-- Anchors are immutable once published. Before publication the row may be
-- completed with its external receipt; after, nothing may change.
CREATE OR REPLACE FUNCTION chain_anchors_immutable() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'chain_anchors is append-only: DELETE refused';
  END IF;
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'This anchor has been published and cannot be changed';
  END IF;
  -- IS DISTINCT FROM rather than <>: <> yields NULL against a NULL and the
  -- check would silently pass.
  IF NEW.merkle_root  IS DISTINCT FROM OLD.merkle_root
     OR NEW.chain_head   IS DISTINCT FROM OLD.chain_head
     OR NEW.from_seq     IS DISTINCT FROM OLD.from_seq
     OR NEW.to_seq       IS DISTINCT FROM OLD.to_seq
     OR NEW.entry_count  IS DISTINCT FROM OLD.entry_count
     OR NEW.anchor_date  IS DISTINCT FROM OLD.anchor_date
     OR NEW.care_home_id IS DISTINCT FROM OLD.care_home_id THEN
    RAISE EXCEPTION 'An anchor''s contents cannot be rewritten';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chain_anchors_immutable ON chain_anchors;
CREATE TRIGGER trg_chain_anchors_immutable
  BEFORE UPDATE OR DELETE ON chain_anchors
  FOR EACH ROW EXECUTE FUNCTION chain_anchors_immutable();

-- ── Integrity findings ─────────────────────────────────────────────────────
-- Records that are implausible on their face. A finding is a prompt to check,
-- never an accusation: there is an ordinary explanation for most of them.

CREATE TABLE IF NOT EXISTS integrity_findings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,

  kind            VARCHAR(40) NOT NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'review'
                  CHECK (severity IN ('review', 'notable', 'urgent')),

  -- Who and what the finding concerns.
  subject_staff_id  UUID REFERENCES users(id) ON DELETE RESTRICT,
  subject_resident_id UUID REFERENCES residents(id) ON DELETE RESTRICT,
  occurred_on     DATE NOT NULL,

  -- Plain-English statement of what was noticed, and the evidence behind it,
  -- so a manager never has to take the system's word for anything.
  summary         TEXT NOT NULL,
  evidence        JSONB NOT NULL,
  record_ids      UUID[] NOT NULL DEFAULT '{}',

  -- A stable identity for the same observation, so re-running the detector
  -- does not pile up duplicates of a finding already dealt with.
  fingerprint     CHAR(64) NOT NULL,

  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'explained', 'action_taken', 'not_an_issue')),
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,

  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT integrity_findings_fingerprint_unique UNIQUE (care_home_id, fingerprint),
  -- Closing a finding requires saying why. A queue that can be cleared without
  -- explanation becomes a queue that is cleared without being read.
  CONSTRAINT integrity_findings_resolution_reasoned
    CHECK (status = 'open' OR (resolution_note IS NOT NULL AND length(btrim(resolution_note)) >= 3))
);

CREATE INDEX IF NOT EXISTS idx_findings_open ON integrity_findings(care_home_id, occurred_on DESC)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_findings_staff ON integrity_findings(subject_staff_id, occurred_on DESC);

-- ── Per-home thresholds ────────────────────────────────────────────────────
-- Defaults are deliberately conservative. A detector that cries wolf gets
-- switched off, and a switched-off detector protects nobody.

CREATE TABLE IF NOT EXISTS integrity_settings (
  care_home_id             UUID PRIMARY KEY REFERENCES care_homes(id) ON DELETE CASCADE,

  -- Fewer minutes than this per resident, across a run of personal care
  -- records, is treated as physically implausible.
  min_minutes_per_resident  NUMERIC(4,1) NOT NULL DEFAULT 3.0,
  burst_min_records         INTEGER NOT NULL DEFAULT 6,
  burst_window_minutes      INTEGER NOT NULL DEFAULT 5,

  -- Recording a piece of care this long after it happened is worth a look.
  late_entry_hours          INTEGER NOT NULL DEFAULT 6,

  -- Checks that depend on other data being accurate are off until the home
  -- says that data is trustworthy. Flagging a carer as "not on shift" because
  -- the rota is out of date destroys trust in the whole feature.
  check_off_shift           BOOLEAN NOT NULL DEFAULT FALSE,
  check_absent_resident     BOOLEAN NOT NULL DEFAULT TRUE,
  check_late_entry          BOOLEAN NOT NULL DEFAULT TRUE,
  check_throughput          BOOLEAN NOT NULL DEFAULT TRUE,
  check_end_of_shift_burst  BOOLEAN NOT NULL DEFAULT TRUE,

  -- Anchoring configuration. Local until a home deliberately turns on
  -- external publication.
  anchor_mode               VARCHAR(20) NOT NULL DEFAULT 'local'
                            CHECK (anchor_mode IN ('local', 'external')),
  anchor_provider           VARCHAR(80),
  anchor_endpoint           TEXT,

  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                UUID REFERENCES users(id)
);

COMMENT ON TABLE record_chain IS
  'Append-only, tamper-evident chain of care records. Proves a record has not '
  'been altered since it was made. Does NOT prove the record is true.';
COMMENT ON TABLE integrity_findings IS
  'Records that look implausible. A prompt to check, never an accusation.';
