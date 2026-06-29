-- Onboarding V2: adds two new profile columns introduced by the
-- restructured flow (goal weight already existed).
--
-- pace_kg_per_week: user-selected pace target (0.25 .. 1.0) — null when
--   goal_type = 'maintain'.
-- medical_conditions: free-form jsonb array of condition strings. Stored
--   for personalization only (e.g. the AI coach can avoid extreme deficits
--   for users with thyroid issues). NEVER used diagnostically.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pace_kg_per_week NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS medical_conditions JSONB DEFAULT '[]'::jsonb;
