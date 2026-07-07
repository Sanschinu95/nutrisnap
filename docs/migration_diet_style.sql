-- ─────────────────────────────────────────────────────────────────────────
-- Replace the archetype system with a neutral diet_style preference (2026-07-02)
--
-- The animal-archetype personas (wolf/bear/lion…), tiers, and progress/levels
-- were removed from the product. The onboarding "eating style" question is
-- kept, but now stores a plain diet_style enum instead of an archetype key.
--
-- Idempotent. Run in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. New column
alter table public.profiles
  add column if not exists diet_style text
  check (diet_style in ('balanced', 'high_protein', 'plant_forward', 'strength'));

-- 2. Backfill from the legacy archetype value (only where the column still exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'archetype'
  ) then
    update public.profiles
    set diet_style = case archetype
      when 'wolf'    then 'high_protein'
      when 'bear'    then 'strength'
      when 'deer'    then 'plant_forward'
      when 'doe'     then 'plant_forward'
      when 'phoenix' then 'plant_forward'
      else 'balanced'          -- lion, tigress, swan, and anything unset
    end
    where diet_style is null;
  end if;
end$$;

-- 3. Drop the legacy archetype / persona columns (safe: pre-launch, no shipped
--    clients still reference them). Dropping a column also drops its CHECK.
alter table public.profiles
  drop column if exists archetype,
  drop column if exists archetype_tier,
  drop column if exists archetype_progress,
  drop column if exists archetype_level;
