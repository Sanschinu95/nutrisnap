-- ============================================================================
-- Notification personality system: preferences + history  (2026-07-09)
--
-- Adapted to NutriSnap's ACTUAL schema (the original spec referenced columns
-- that don't exist):
--   * profiles.name                    (spec said display_name)
--   * streaks.current_streak_count     (spec said streaks.current_streak)
--   * profiles.id is the profile PK    (references auth.users(id))
--
-- notification_preferences: one row per user, auto-created by trigger when a
-- profile row is inserted, backfilled for existing users.
--
-- notification_history: dedup + variety tracking for dynamic notifications
-- (streak_at_risk / encouragement / missed_you) and interaction analytics.
-- Repeating daily reminders are tracked client-side (AsyncStorage) and via
-- the `events` telemetry table, not here — a row per repeat would be noise.
--
-- Idempotent where practical. Run in the Supabase SQL editor.
-- ============================================================================

-- ── 1. Preferences ──────────────────────────────────────────────────────────
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Master toggle
  notifications_enabled boolean not null default true,

  -- Individual categories
  meal_reminders_enabled boolean not null default true,
  hydration_reminders_enabled boolean not null default true,
  sleep_reminders_enabled boolean not null default true,
  streak_reminders_enabled boolean not null default true,
  encouragement_enabled boolean not null default true,
  checkin_enabled boolean not null default true,  -- "missed you today" style

  -- Meal times (24h)
  breakfast_time time not null default '08:30',
  lunch_time time not null default '13:00',
  snack_time time not null default '17:00',
  dinner_time time not null default '20:00',

  -- Hydration cadence (hours between reminders during active hours)
  hydration_interval_hours integer not null default 2
    check (hydration_interval_hours between 1 and 6),
  hydration_start_hour integer not null default 8
    check (hydration_start_hour between 0 and 23),
  hydration_end_hour integer not null default 22
    check (hydration_end_hour between 0 and 23),

  -- Sleep
  sleep_reminder_time time not null default '22:30',  -- "wind down" reminder
  wake_confirmation_hour integer not null default 8
    check (wake_confirmation_hour between 0 and 23),

  -- Quiet hours (no notifications inside this window; wraps midnight)
  quiet_hours_enabled boolean not null default true,
  quiet_hours_start time not null default '23:00',
  quiet_hours_end time not null default '07:00',

  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users manage own notification prefs" on public.notification_preferences;
create policy "Users manage own notification prefs"
  on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auto-create prefs when a profile row appears.
create or replace function public.create_notification_prefs_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trigger_create_notification_prefs on public.profiles;
create trigger trigger_create_notification_prefs
  after insert on public.profiles
  for each row execute function public.create_notification_prefs_for_new_user();

-- Backfill existing users (safe to re-run).
insert into public.notification_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- ── 2. History (dynamic-notification dedup + interaction analytics) ─────────
create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  -- 'meal_breakfast' | 'meal_lunch' | 'meal_snack' | 'meal_dinner'
  -- 'hydration' | 'sleep_wind_down' | 'sleep_check_in'
  -- 'streak_at_risk' | 'encouragement' | 'missed_you' | 'milestone'
  copy_variant_id text,           -- which specific line was used
  sent_at timestamptz not null default now(),
  interacted_at timestamptz,      -- when user tapped/opened
  interaction_type text
    check (interaction_type in ('opened', 'dismissed', 'action_taken'))
);

create index if not exists idx_notif_history_user_type_date
  on public.notification_history(user_id, notification_type, sent_at);

alter table public.notification_history enable row level security;

drop policy if exists "Users read own notification history" on public.notification_history;
create policy "Users read own notification history"
  on public.notification_history for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users insert own notification history" on public.notification_history;
create policy "Users insert own notification history"
  on public.notification_history for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own notification history" on public.notification_history;
create policy "Users update own notification history"
  on public.notification_history for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
