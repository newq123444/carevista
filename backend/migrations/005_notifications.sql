-- ============================================================
-- Notifications table & care_tasks missing columns
-- ============================================================

-- ── NOTIFICATIONS TABLE ──────────────────────────────────────────────────

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE RESTRICT,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  type            VARCHAR(100) NOT NULL,
  title           VARCHAR(500) NOT NULL,
  body            TEXT,
  entity_type     VARCHAR(100),
  entity_id       UUID,
  priority        VARCHAR(20) DEFAULT 'normal',
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(care_home_id, user_id, created_at);
CREATE INDEX idx_notifications_type_entity ON notifications(care_home_id, type, entity_id, created_at);

-- ── CARE TASKS — ADD MISSING COLUMNS ─────────────────────────────────────

ALTER TABLE care_tasks ADD COLUMN in_progress_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE care_tasks ADD COLUMN in_progress_since TIMESTAMPTZ;
ALTER TABLE care_tasks ADD COLUMN in_progress_name VARCHAR(200);
ALTER TABLE care_tasks ADD COLUMN notes TEXT;
ALTER TABLE care_tasks ADD COLUMN deferred_reason TEXT;
