-- 022_occupancy_sync.sql
-- Occupancy was recorded manually and could drift from the real resident count.
-- A single record per home per day lets us upsert a live-derived snapshot.

DELETE FROM occupancy_records a USING occupancy_records b
  WHERE a.care_home_id = b.care_home_id
    AND a.record_date = b.record_date
    AND a.ctid < b.ctid;

ALTER TABLE occupancy_records DROP CONSTRAINT IF EXISTS occupancy_records_home_date_key;
ALTER TABLE occupancy_records ADD CONSTRAINT occupancy_records_home_date_key UNIQUE (care_home_id, record_date);
