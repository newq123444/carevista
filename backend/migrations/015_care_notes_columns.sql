-- ============================================================
-- 015: Add missing columns to care_notes table
-- The careNotes controller references columns not in the original schema
-- ============================================================

ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS meal_context JSONB;
ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS written_on_behalf_of_name VARCHAR(200);
ALTER TABLE care_notes ADD COLUMN IF NOT EXISTS co_author_names JSONB;
