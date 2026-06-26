-- Add structured dietary preferences to profiles.
-- Shape: { allergies: string[], diets: string[], custom: string[] }
-- Collected on the diet onboarding step; previously dropped on the way to
-- transition.tsx because there was no column to store it in.

alter table public.profiles
  add column if not exists dietary_preferences jsonb;
