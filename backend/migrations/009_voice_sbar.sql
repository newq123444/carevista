-- Migration 009: Voice transcription & SBAR handover tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Voice Transcriptions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_transcriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id          UUID NOT NULL REFERENCES care_homes(id),
  user_id               UUID NOT NULL REFERENCES users(id),
  resident_id           UUID REFERENCES residents(id),
  audio_duration_seconds INTEGER,
  transcription_text    TEXT NOT NULL,
  confidence_score      DECIMAL(3,2),
  care_note_id          UUID REFERENCES care_notes(id),
  status                VARCHAR(20) NOT NULL DEFAULT 'transcribed'
                        CHECK (status IN ('transcribed','converted_to_note','discarded')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voice_transcriptions_user_date
  ON voice_transcriptions (care_home_id, user_id, created_at DESC);

-- ── SBAR Handovers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sbar_handovers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id      UUID NOT NULL REFERENCES care_homes(id),
  generated_by      UUID NOT NULL REFERENCES users(id),
  shift_date        DATE NOT NULL,
  shift_type        VARCHAR(20) NOT NULL,
  situation         TEXT,
  background        TEXT,
  assessment        TEXT,
  recommendation    TEXT,
  residents_covered UUID[] DEFAULT '{}',
  key_concerns      JSONB DEFAULT '[]',
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','rejected')),
  approved_by       UUID REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sbar_handovers_date
  ON sbar_handovers (care_home_id, shift_date DESC);
