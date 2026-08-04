-- 017: task-template frequency support (daily vs weekly cadence)
ALTER TABLE care_task_templates ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) NOT NULL DEFAULT 'daily';
ALTER TABLE care_task_templates ADD COLUMN IF NOT EXISTS day_of_week INTEGER;  -- 0=Sun..6=Sat, for weekly tasks
