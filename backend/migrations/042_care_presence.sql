-- ───────────────────────────────────────────────────────────────────────────
-- 042_care_presence.sql
--
-- "Ana is with Ernie — personal care, 3 minutes ago."
--
-- Stopping a duplicate at Save is the last line of defence; better that the
-- second carer never starts. When a carer opens the record sheet for a
-- resident, the app says so here; everyone else sees it on the resident, on
-- Record care and in the residents grid, and is asked before starting the
-- same care. It is not a care record: rows expire after 15 minutes and are
-- removed as soon as the carer saves or cancels. Nothing here is chained.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care_presence (
  care_home_id  UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id   UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name     VARCHAR(200) NOT NULL,
  care_type     VARCHAR(40) NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  PRIMARY KEY (resident_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_care_presence_home ON care_presence(care_home_id, expires_at);

COMMENT ON TABLE care_presence IS
  'Who is with which resident right now, for which care (v89b). Expires after 15 minutes; not a care record.';
