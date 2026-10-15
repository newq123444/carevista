-- ───────────────────────────────────────────────────────────────────────────
-- 033_note_types.sql
--
-- Six note types the app offers a carer do not exist in the note_type enum.
-- Choosing any of them — continence care, a wound, a fall, an activity, end of
-- life care, a handover note — makes the INSERT fail and the carer sees a
-- server error with no explanation. The care simply does not get recorded.
--
-- Continence is the one that matters most: it is among the most frequently
-- recorded care in any home, it is central to dignity and to pressure ulcer
-- prevention, and it has been silently unrecordable.
--
-- ALTER TYPE ... ADD VALUE runs inside a transaction on PostgreSQL 12 and
-- later provided the new value is not used in the same transaction. Nothing
-- here uses them, so this is safe under the migration runner, which wraps each
-- file in BEGIN/COMMIT.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TYPE note_type ADD VALUE IF NOT EXISTS 'continence';
ALTER TYPE note_type ADD VALUE IF NOT EXISTS 'wound_care';
ALTER TYPE note_type ADD VALUE IF NOT EXISTS 'fall_observation';
ALTER TYPE note_type ADD VALUE IF NOT EXISTS 'activities';
ALTER TYPE note_type ADD VALUE IF NOT EXISTS 'end_of_life';
ALTER TYPE note_type ADD VALUE IF NOT EXISTS 'handover';
