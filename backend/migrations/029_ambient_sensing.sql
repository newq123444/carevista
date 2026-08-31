-- 029_ambient_sensing.sql
--
-- Ambient night sensing: knowing how a resident's night actually went without
-- waking them to find out, and without a camera or a wearable.
--
-- THE PRIVACY CONTRACT, which is the point of the design:
--
--   No audio is ever transmitted or stored. The sensor classifies sound on the
--   device and sends only a label and a confidence — "cough", "call_out",
--   "fall_impact" — never a recording, never a transcript, never a waveform.
--   The same applies to presence: the radar reports occupancy and gross
--   movement, not an image.
--
--   This matters legally as well as ethically. Continuous audio or video in a
--   bedroom is surveillance of a person who often cannot consent to it, and
--   engages both UK GDPR special-category processing and the Mental Capacity
--   Act. An event label carries the clinical signal without the intrusion.
--
-- Devices authenticate with a hashed key, are bound to one room, and can be
-- disabled instantly. A resident or their representative can refuse sensing and
-- the room is simply excluded.

CREATE TABLE IF NOT EXISTS sensor_devices (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id       UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  room_number        VARCHAR(20) NOT NULL,
  resident_id        UUID REFERENCES residents(id) ON DELETE SET NULL,

  device_name        VARCHAR(120) NOT NULL,
  device_type        VARCHAR(30) NOT NULL DEFAULT 'presence'
                     CHECK (device_type IN ('presence','acoustic','presence_acoustic','environment')),
  hardware_model     VARCHAR(80),
  firmware_version   VARCHAR(40),

  -- Devices authenticate with a bearer key; only its hash is stored, exactly as
  -- a password would be.
  api_key_hash       VARCHAR(255) NOT NULL,
  api_key_prefix     VARCHAR(12) NOT NULL,

  -- Consent is per resident and can be withdrawn at any time. When sensing is
  -- not consented the device stops being accepted for that room.
  consent_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (consent_status IN ('pending','given','refused','withdrawn')),
  consent_basis      VARCHAR(30)
                     CHECK (consent_basis IN ('resident_consent','best_interests','lpa_consent')),
  consent_recorded_by UUID REFERENCES users(id),
  consent_recorded_at TIMESTAMPTZ,
  consent_notes      TEXT,

  active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at       TIMESTAMPTZ,
  battery_percent    INTEGER,

  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sensor_devices_home ON sensor_devices(care_home_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sensor_devices_key ON sensor_devices(api_key_prefix);

-- Raw observations. Deliberately small and dumb: a label, a value, a time.
CREATE TABLE IF NOT EXISTS sensor_observations (
  id             BIGSERIAL PRIMARY KEY,
  care_home_id   UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  device_id      UUID NOT NULL REFERENCES sensor_devices(id) ON DELETE CASCADE,
  resident_id    UUID REFERENCES residents(id) ON DELETE SET NULL,

  observed_at    TIMESTAMPTZ NOT NULL,
  signal         VARCHAR(30) NOT NULL CHECK (signal IN (
                   'presence','absence','motion','bed_occupied','bed_exit',
                   'sound_event','light_level','temperature','humidity')),
  -- For sound_event: the on-device classification label. Never a recording.
  event_label    VARCHAR(40) CHECK (event_label IN (
                   'cough','call_out','speech','distress','snore','fall_impact',
                   'door','alarm','other','none')),
  confidence     DECIMAL(4,3) CHECK (confidence BETWEEN 0 AND 1),
  numeric_value  DECIMAL(10,3),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_observations_resident_time
  ON sensor_observations(resident_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_home_time
  ON sensor_observations(care_home_id, observed_at DESC);

-- Inferred, clinically meaningful events. This is what staff actually read.
CREATE TABLE IF NOT EXISTS night_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id   UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id    UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  night_of       DATE NOT NULL,

  event_type     VARCHAR(30) NOT NULL CHECK (event_type IN (
                   'settled','restless','out_of_bed','out_of_bed_prolonged',
                   'distress','repeated_coughing','possible_fall','left_room','unsettled_return')),
  started_at     TIMESTAMPTZ NOT NULL,
  ended_at       TIMESTAMPTZ,
  duration_mins  INTEGER,
  severity       VARCHAR(10) NOT NULL DEFAULT 'info'
                 CHECK (severity IN ('info','attention','urgent')),

  -- Why the system thinks this: the observations behind it, in plain words.
  evidence       TEXT,
  confidence     DECIMAL(4,3),

  -- Was anyone with them? Correlated with care notes so the record shows
  -- whether a disturbance was responded to.
  staff_attended BOOLEAN,
  attended_within_mins INTEGER,

  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_night_events_resident ON night_events(resident_id, night_of DESC);
CREATE INDEX IF NOT EXISTS idx_night_events_home ON night_events(care_home_id, night_of DESC, severity);
CREATE UNIQUE INDEX IF NOT EXISTS idx_night_events_dedupe
  ON night_events(resident_id, event_type, started_at);
