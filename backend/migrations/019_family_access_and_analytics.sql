-- 019_family_access_and_analytics.sql
-- Family portal access: multiple family members per resident + invites.

CREATE TABLE IF NOT EXISTS family_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id   UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship  VARCHAR(100),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resident_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_family_links_user ON family_links(user_id);
CREATE INDEX IF NOT EXISTS idx_family_links_resident ON family_links(resident_id);

CREATE TABLE IF NOT EXISTS family_invites (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id     UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id      UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  email            VARCHAR(255),
  code             VARCHAR(24) NOT NULL UNIQUE,
  relationship     VARCHAR(100),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | revoked
  created_by       UUID REFERENCES users(id),
  accepted_user_id UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at      TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_family_invites_code ON family_invites(code);
CREATE INDEX IF NOT EXISTS idx_family_invites_home ON family_invites(care_home_id, status);
