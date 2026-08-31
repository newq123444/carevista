-- 028_about_me.sql
--
-- Aligning the person-centred part of the care plan with the PRSB "About Me"
-- standard, which is one of the capabilities NHS England assures for the
-- Digital Social Care Record supplier list (PRSB is the assurance body for
-- About Me and for the Personalised Care and Support Plan).
--
-- The plan already carried: what matters to me, how to support me best, what
-- upsets me, my routine, how I communicate, culture and faith. These are the
-- items the standard expects that were missing.
--
-- Conformance still has to be assessed by PRSB against the published
-- information model — this aligns the shape, it does not certify it.

ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS people_who_matter        TEXT;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS how_i_take_my_medication TEXT;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS sensory_mobility_support TEXT;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS what_makes_me_anxious    TEXT;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS my_strengths            TEXT;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS please_do_not           TEXT;

COMMENT ON COLUMN care_plans.people_who_matter IS
  'About Me: the people important to this person, and their role in their life.';
COMMENT ON COLUMN care_plans.how_i_take_my_medication IS
  'About Me: how the person prefers to take medicines (with food, crushed, timing).';
COMMENT ON COLUMN care_plans.sensory_mobility_support IS
  'About Me: glasses, hearing aids, walking aids and how they should be used.';
COMMENT ON COLUMN care_plans.my_strengths IS
  'About Me: what the person can do and wants to keep doing for themselves.';
COMMENT ON COLUMN care_plans.please_do_not IS
  'About Me: things staff should not do, in the person''s own words.';
