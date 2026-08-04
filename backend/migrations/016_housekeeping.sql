-- ============================================================
-- 016: Housekeeping / cleaning checklists (digitises the paper
-- "Weekly / Daily / 3-Monthly Housekeeping check lists").
-- ============================================================

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID REFERENCES care_homes(id) ON DELETE CASCADE,   -- NULL = applies to all homes
  category      VARCHAR(30) NOT NULL,   -- daily_room | weekly_room | quarterly_room | daily_communal
  area_label    VARCHAR(60),            -- communal area name (for daily_communal); NULL for room checklists
  specification TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_cat ON housekeeping_tasks(category, area_label);

CREATE TABLE IF NOT EXISTS housekeeping_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id  UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  category      VARCHAR(30) NOT NULL,
  location_type VARCHAR(20) NOT NULL,   -- resident_room | communal
  room_number   VARCHAR(20),
  resident_id   UUID REFERENCES residents(id) ON DELETE SET NULL,
  communal_area VARCHAR(60),
  task_id       UUID REFERENCES housekeeping_tasks(id) ON DELETE SET NULL,
  specification TEXT NOT NULL,
  period_date   DATE NOT NULL,
  initials      VARCHAR(10),
  completed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hk_logs_lookup ON housekeeping_logs(care_home_id, category, period_date);
CREATE INDEX IF NOT EXISTS idx_hk_logs_room ON housekeeping_logs(care_home_id, room_number, period_date);

-- ── Seed the specification templates (only if empty) ────────────────────────
INSERT INTO housekeeping_tasks (category, area_label, specification, sort_order)
SELECT category, area_label, specification, sort_order FROM (VALUES
  -- Daily resident room
  ('daily_room', NULL::varchar, 'Remove waste - Empty all bins', 1),
  ('daily_room', NULL, 'Vacuum clean floors / swept', 2),
  ('daily_room', NULL, 'Remove any obvious dirt/spillages from floors & surface', 3),
  ('daily_room', NULL, 'General clean to sanitary fittings, soap dishes', 4),
  ('daily_room', NULL, 'Sweep & wash floor in suite / room', 5),
  ('daily_room', NULL, 'Replenish consumables - toilet rolls, paper towels', 6),
  ('daily_room', NULL, 'All door handles and railing around the house', 7),
  -- Weekly resident room
  ('weekly_room', NULL, 'Vacuum clean floor areas including under the beds', 1),
  ('weekly_room', NULL, 'Dust fixtures & fittings', 2),
  ('weekly_room', NULL, 'Dust high level corners & ledges, top of the wardrobes etc.', 3),
  ('weekly_room', NULL, 'Dust skirting boards', 4),
  ('weekly_room', NULL, 'Dust pictures, ornaments etc.', 5),
  ('weekly_room', NULL, 'Remove finger marks etc. from door frames & switches', 6),
  ('weekly_room', NULL, 'Spot clean carpets', 7),
  -- Quarterly (3-monthly) resident room
  ('quarterly_room', NULL, 'Wash down all gloss paintwork', 1),
  ('quarterly_room', NULL, 'Curtains to be washed as per label instructions in the communal rooms/corridors', 2),
  ('quarterly_room', NULL, 'Fans in the bathrooms to be cleaned', 3),
  ('quarterly_room', NULL, 'Clean all lampshades/lights', 4),
  ('quarterly_room', NULL, 'Check towels and bed linen for any damages and stains', 5),
  ('quarterly_room', NULL, 'Inspect and clean mattress, pillows and all bedding for needed replacement or repairs', 6),
  ('quarterly_room', NULL, 'Cleaned the sink/tube using limescale spray removal', 7),
  -- Daily communal — Lounge
  ('daily_communal', 'Lounge', 'Remove waste - Empty all bins', 1),
  ('daily_communal', 'Lounge', 'Vacuum/wash thoroughly all available floor areas including under the armchairs', 2),
  ('daily_communal', 'Lounge', 'Remove any obvious dirt/spillages from floors & surface', 3),
  ('daily_communal', 'Lounge', 'Armchairs must be cleaned', 4),
  ('daily_communal', 'Lounge', 'General cleaning and tidy up', 5),
  ('daily_communal', 'Lounge', 'Dust the surfaces', 6),
  ('daily_communal', 'Lounge', 'Make sure the curtains are tidy and clean', 7),
  ('daily_communal', 'Lounge', 'Clean the flower area', 8),
  ('daily_communal', 'Lounge', 'Technology appliance (phone, tablet, iPad, etc.)', 9),
  -- Daily communal — Dining Room
  ('daily_communal', 'Dining Room', 'Vacuum/wash thoroughly all available floor areas including under the tables and chairs', 1),
  ('daily_communal', 'Dining Room', 'Remove any obvious dirt/spillages from floors & surface', 2),
  ('daily_communal', 'Dining Room', 'General cleaning and tidy up', 3),
  ('daily_communal', 'Dining Room', 'Clean the tables and the chairs', 4),
  ('daily_communal', 'Dining Room', 'Dust additional surfaces', 5),
  ('daily_communal', 'Dining Room', 'Make sure the curtains are tidy and clean', 6),
  -- Daily communal — Conservatory
  ('daily_communal', 'Conservatory', 'Remove waste - Empty the bin', 1),
  ('daily_communal', 'Conservatory', 'Vacuum/wash thoroughly all available floor areas including under the armchairs', 2),
  ('daily_communal', 'Conservatory', 'Remove any obvious dirt/spillages from floors & surface', 3),
  ('daily_communal', 'Conservatory', 'General cleaning and tidy up', 4),
  ('daily_communal', 'Conservatory', 'Clean the tables', 5),
  ('daily_communal', 'Conservatory', 'Dust the shelves', 6),
  ('daily_communal', 'Conservatory', 'Dust all the lights', 7),
  ('daily_communal', 'Conservatory', 'Clean the flowers area', 8),
  -- Daily communal — Hallway Upstairs
  ('daily_communal', 'Hallway Upstairs', 'Vacuum/wash all available floor and the stairs', 1),
  ('daily_communal', 'Hallway Upstairs', 'Remove any obvious dirt/spillages from floors & surface', 2),
  ('daily_communal', 'Hallway Upstairs', 'General clean and tidying', 3),
  ('daily_communal', 'Hallway Upstairs', 'Wipe the handrail, dust / remove any cobwebs', 4),
  -- Daily communal — Hallway Downstairs
  ('daily_communal', 'Hallway Downstairs', 'Vacuum/wash all available floor areas', 1),
  ('daily_communal', 'Hallway Downstairs', 'Remove any obvious dirt/spillages from floors & surface', 2),
  ('daily_communal', 'Hallway Downstairs', 'General clean and tidying', 3),
  ('daily_communal', 'Hallway Downstairs', 'Wipe the handrail, dust / remove any cobwebs', 4),
  -- Daily communal — Door Handles and Handrails
  ('daily_communal', 'Door Handles & Handrails', 'MORNING - Clean and Disinfect all the door handles and handrails around the home', 1),
  ('daily_communal', 'Door Handles & Handrails', 'AFTERNOON - Clean and Disinfect all the door handles and handrails around the home', 2)
) AS v(category, area_label, specification, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM housekeeping_tasks);
