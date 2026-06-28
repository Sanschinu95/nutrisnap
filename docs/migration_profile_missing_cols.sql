-- Add columns the V1 user.store expects on profiles but that aren't in
-- the current Supabase schema. Caught by the onboarding upsert failing with:
--   "Could not find the 'archetype_level' column of 'profiles'"

alter table public.profiles
  add column if not exists archetype_progress integer not null default 0,
  add column if not exists archetype_level text not null default 'pup',
  add column if not exists feedback_submitted boolean not null default false;
