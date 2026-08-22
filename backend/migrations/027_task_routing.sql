-- 027_task_routing.sql
--
-- Two problems with care tasks, both found in use:
--
-- 1. MEDICATION TASKS WERE TICKABLE BY CARERS.
--    "Morning Medications" appeared on the carer's task list next to Breakfast.
--    A carer could mark it done with no entry on the MAR chart at all — so the
--    task board said medication was given while eMAR said nothing was. Two
--    records of the same event, disagreeing, one of them signed by somebody who
--    may not be medication-competent. Medicines are administered and signed on
--    the MAR by a competent person; the task list may only *reflect* that.
--
--    handled_in = 'emar' marks those tasks as owned by the MAR chart. Their
--    status is derived from med_administrations, they cannot be completed from
--    the task board, and tapping one opens eMAR for that resident.
--
-- 2. EVERY TASK OPENED THE FORM FOR ITS CATEGORY, NOT ITS PURPOSE.
--    "Night Settle & Check" is category personal_care, so it opened the full
--    bathing/shaving/oral-care form. Staff then either recorded the wrong thing
--    or recorded nothing. note_type pins each task to the form that matches
--    what is actually being done.

ALTER TABLE care_task_templates ADD COLUMN IF NOT EXISTS note_type VARCHAR(40);
ALTER TABLE care_task_templates ADD COLUMN IF NOT EXISTS handled_in VARCHAR(20) NOT NULL DEFAULT 'care_note';
ALTER TABLE care_tasks          ADD COLUMN IF NOT EXISTS note_type VARCHAR(40);
ALTER TABLE care_tasks          ADD COLUMN IF NOT EXISTS handled_in VARCHAR(20) NOT NULL DEFAULT 'care_note';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_task_templates_handled_in_check') THEN
    ALTER TABLE care_task_templates ADD CONSTRAINT care_task_templates_handled_in_check
      CHECK (handled_in IN ('care_note','emar'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_tasks_handled_in_check') THEN
    ALTER TABLE care_tasks ADD CONSTRAINT care_tasks_handled_in_check
      CHECK (handled_in IN ('care_note','emar'));
  END IF;
END $$;

-- ── Medication tasks belong to the MAR chart ───────────────────────────────
UPDATE care_task_templates SET handled_in = 'emar' WHERE category = 'medication';
UPDATE care_tasks          SET handled_in = 'emar' WHERE category = 'medication';

-- Any medication task a carer previously ticked from the task board was never
-- a medicines record. Reset those so the board stops asserting something the
-- MAR chart cannot support; the MAR remains the only source of truth.
UPDATE care_tasks
   SET status = 'pending', completed_by = NULL, completed_at = NULL
 WHERE category = 'medication' AND status = 'done';

-- ── Point each task at the right form ──────────────────────────────────────
UPDATE care_task_templates SET note_type = CASE
  WHEN name ILIKE '%Continence%'                      THEN 'continence'
  WHEN name ILIKE '%Night Settle%'                    THEN 'sleep'
  WHEN name ILIKE '%Night Observation%'               THEN 'sleep'
  WHEN name ILIKE '%Exercise%'                        THEN 'activities'
  WHEN name ILIKE '%Sensory%' OR name ILIKE '%Wellbeing%' THEN 'social_wellbeing'
  WHEN name ILIKE '%Skin & Pressure%'                 THEN 'nursing_observation'
  WHEN category = 'medication'                        THEN NULL
  WHEN category = 'nutrition'                         THEN 'nutrition'
  WHEN category = 'repositioning'                     THEN 'repositioning'
  WHEN category = 'observation'                       THEN 'nursing_observation'
  WHEN category = 'social_wellbeing'                  THEN 'social_wellbeing'
  WHEN category = 'physical'                          THEN 'activities'
  ELSE 'personal_care'
END
WHERE note_type IS NULL;

-- Backfill tasks already generated for today and later from their template.
UPDATE care_tasks ct
   SET note_type = ctt.note_type
  FROM care_task_templates ctt
 WHERE ct.template_id = ctt.id
   AND ct.note_type IS NULL
   AND ct.task_date >= CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_care_tasks_handled_in ON care_tasks(care_home_id, task_date, handled_in);
