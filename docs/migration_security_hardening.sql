-- ─────────────────────────────────────────────────────────────────────────
-- Security hardening (2026-07-02)
--
-- Closes two classes of pre-launch vulnerability found during the launch audit:
--
--   1. SECURITY DEFINER RPCs that trusted a caller-supplied user id, letting
--      any caller read or modify ANOTHER user's data (RLS is bypassed inside
--      SECURITY DEFINER functions). Now every function derives the user from
--      auth.uid() and refuses to act on anyone else's rows. EXECUTE is also
--      revoked from anon/public.
--
--   2. Analytics rollup tables shipped without row-level security, leaving them
--      readable/writable through the public anon key. RLS is enabled with no
--      client policy (deny-all); they are written by the SECURITY DEFINER cron
--      job — which runs as the table owner and bypasses RLS — and read by
--      admins via the service role.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1a. export_user_data: only ever export the CALLER's own data ──────────
-- Was: language sql, filtered by the caller-supplied target_user_id (any
-- authenticated user could dump any user's profile/weights/meals/hydration).
-- Now: guarded by auth.uid(); the argument is kept only so existing callers
-- resolve, but it must equal the authenticated user.
create or replace function public.export_user_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  if target_user_id is distinct from auth.uid() then
    raise exception 'forbidden: can only export your own data';
  end if;

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'weights', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.logged_at)
      from public.weight_logs w where w.user_id = auth.uid()
    ), '[]'::jsonb),
    'meals', coalesce((
      select jsonb_agg(
        to_jsonb(m) || jsonb_build_object(
          'food_items',
          coalesce((select jsonb_agg(to_jsonb(fi)) from public.food_items fi where fi.meal_id = m.id), '[]'::jsonb)
        )
        order by m.occurred_at_utc
      )
      from public.meals m where m.user_id = auth.uid()
    ), '[]'::jsonb),
    'hydration_logs', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.occurred_at_utc)
      from public.hydration_logs h where h.user_id = auth.uid()
    ), '[]'::jsonb),
    'streak', (select to_jsonb(s) from public.streaks s where s.user_id = auth.uid())
  );
end;
$$;

-- ── 1b. anonymize_scan_feedback_for_user: only the CALLER's own rows ───────
-- Was: nulled scan_feedback.user_id WHERE user_id = <caller-supplied id>.
-- Now: guarded by auth.uid(); a caller can only de-identify their own rows.
create or replace function public.anonymize_scan_feedback_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  if target_user_id is distinct from auth.uid() then
    raise exception 'forbidden: can only anonymize your own scan feedback';
  end if;

  update public.scan_feedback
  set user_id = null
  where user_id = auth.uid();
end;
$$;

-- ── 1c. Lock down EXECUTE grants ──────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default. Revoke, then grant only to the
-- authenticated role. (nullify_training_for_self already does this correctly.)
revoke execute on function public.export_user_data(uuid) from public;
revoke execute on function public.anonymize_scan_feedback_for_user(uuid) from public;
grant execute on function public.export_user_data(uuid) to authenticated;
grant execute on function public.anonymize_scan_feedback_for_user(uuid) to authenticated;

-- refresh_event_rollups() is an internal cron job, never meant to be callable
-- from the app. The scheduled job runs as the table owner, so revoking the API
-- roles here does not affect it. Guarded in case the function isn't present.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'refresh_event_rollups'
  ) then
    revoke execute on function public.refresh_event_rollups() from public;
  end if;
end$$;

-- ── 2. Row-level security on the analytics rollup tables ──────────────────
-- No client policy is added on purpose: these are populated by the cron job
-- (SECURITY DEFINER, owner-privileged → bypasses RLS) and read by admins with
-- the service role. Enabling RLS with no policy = deny-all for anon/authenticated.
alter table if exists public.daily_active_users            enable row level security;
alter table if exists public.feature_usage_daily           enable row level security;
alter table if exists public.notification_open_rate_daily  enable row level security;
