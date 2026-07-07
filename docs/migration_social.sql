-- ============================================================================
-- Social layer: friends, leaderboards, referrals  (2026-07-03)
--
-- Adapted to NutriSnap's ACTUAL schema (the original spec referenced columns
-- that don't exist):
--   * profiles.name           (spec said display_name)
--   * streaks.current_streak_count   (spec said current_streak)
--   * profiles.longest_streak        (longest lives on profiles, not streaks)
--   * meals.occurred_at_local        (spec said meals.created_at)
--   * consistency is computed here    (spec assumed a compute_consistency_score())
--
-- SECURITY MODEL (important): the original spec exposed a `public_profiles`
-- VIEW granted to every authenticated user. Postgres views bypass the base
-- table's RLS, so that would let ANY user scrape EVERY user's name + streak +
-- consistency and enumerate friend codes — the opposite of "friends only".
-- Instead, all cross-user reads go through SECURITY DEFINER functions that are
-- scoped to auth.uid() and the caller's friendships. Raw tables keep RLS for
-- defense in depth; mutations run through functions so rules can't be bypassed.
--
-- Idempotent where practical. Run in the Supabase SQL editor.
-- ============================================================================

-- ── 1. Friend codes + ghost mode on profiles ───────────────────────────────
alter table public.profiles add column if not exists friend_code text unique;
alter table public.profiles add column if not exists is_ghost_mode boolean not null default false;
create index if not exists idx_profiles_friend_code on public.profiles(friend_code);

create or replace function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no confusable I/O/0/1
  code text;
  attempts int := 0;
begin
  loop
    code := 'NUTRI-';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    if not exists (select 1 from public.profiles where friend_code = code) then
      return code;
    end if;
    attempts := attempts + 1;
    if attempts > 12 then
      raise exception 'Failed to generate unique friend code';
    end if;
  end loop;
end;
$$;

-- Auto-assign on new profile rows.
create or replace function public.assign_friend_code_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.friend_code is null then
    new.friend_code := public.generate_friend_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_assign_friend_code on public.profiles;
create trigger trigger_assign_friend_code
  before insert on public.profiles
  for each row execute function public.assign_friend_code_on_insert();

-- Backfill existing users (safe to re-run).
update public.profiles set friend_code = public.generate_friend_code() where friend_code is null;

-- ── 2. Tables ───────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists idx_friendships_user on public.friendships(user_id);
create index if not exists idx_friendships_friend on public.friendships(friend_id);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  unique(from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);
create index if not exists idx_friend_requests_to on public.friend_requests(to_user_id, status);
create index if not exists idx_friend_requests_from on public.friend_requests(from_user_id, status);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending','qualified','expired')),
  suspicion_flag boolean not null default false,
  referred_signed_up_at timestamptz default now(),
  qualified_at timestamptz,
  unique(referred_id)
);
create index if not exists idx_referrals_referrer on public.referrals(referrer_id, status);

create table if not exists public.pro_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  granted_at timestamptz default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true
);
create index if not exists idx_pro_rewards_user_active on public.pro_rewards(user_id, is_active, expires_at);

-- ── 3. RLS (read scoping) ───────────────────────────────────────────────────
alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.referrals enable row level security;
alter table public.pro_rewards enable row level security;

drop policy if exists "read own friendships" on public.friendships;
create policy "read own friendships" on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "read own requests" on public.friend_requests;
create policy "read own requests" on public.friend_requests for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

drop policy if exists "read own referrals" on public.referrals;
create policy "read own referrals" on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());

-- The referred user creates their own referral row at signup.
drop policy if exists "referred user inserts referral" on public.referrals;
create policy "referred user inserts referral" on public.referrals for insert to authenticated
  with check (referred_id = auth.uid());

drop policy if exists "read own rewards" on public.pro_rewards;
create policy "read own rewards" on public.pro_rewards for select to authenticated
  using (user_id = auth.uid());

-- Mutations on friendships / friend_requests go ONLY through the SECURITY
-- DEFINER functions below, so revoke direct write access from the API roles.
revoke insert, update, delete on public.friendships from anon, authenticated;
revoke insert, update, delete on public.friend_requests from anon, authenticated;

-- ── 4. Consistency score (0-100 over a date range) ──────────────────────────
-- Weighting matches the in-app score: meals 40% + hydration 30% + active 30%.
create or replace function public.compute_consistency_score_range(p_user_id uuid, p_start date, p_end date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with span as (select greatest(1, (p_end - p_start) + 1)::numeric as days),
  meal_days as (
    select count(distinct m.occurred_at_local::date) as n from public.meals m
    where m.user_id = p_user_id and m.occurred_at_local::date between p_start and p_end
  ),
  hyd_days as (
    select count(distinct h.occurred_at_local::date) as n from public.hydration_logs h
    where h.user_id = p_user_id and h.occurred_at_local::date between p_start and p_end
  ),
  active_days as (
    select count(distinct d) as n from (
      select occurred_at_local::date as d from public.meals
        where user_id = p_user_id and occurred_at_local::date between p_start and p_end
      union
      select occurred_at_local::date from public.hydration_logs
        where user_id = p_user_id and occurred_at_local::date between p_start and p_end
    ) u
  )
  select round(
    least(1, (select n from meal_days) / (select days from span)) * 40 +
    least(1, (select n from hyd_days) / (select days from span)) * 30 +
    least(1, (select n from active_days) / (select days from span)) * 30
  )::integer;
$$;

-- ── 5. Read APIs (friend-scoped) ────────────────────────────────────────────

-- Resolve a single code → (id, name). Exact match only, so codes can't be
-- enumerated/scraped. Never returns the caller's own row as a "found" friend.
create or replace function public.find_user_by_friend_code(p_code text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name from public.profiles p
  where p.friend_code = upper(trim(p_code))
  limit 1;
$$;

-- The caller's friends. Ghost-mode friends are still listed (you know you're
-- connected) but their stats come back null so the client shows "Hidden".
create or replace function public.get_friends()
returns table (
  friend_id uuid, friend_code text, name text,
  current_streak integer, consistency_score integer, is_ghost_mode boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.friend_code,
    p.name,
    case when p.is_ghost_mode then null else coalesce(s.current_streak_count, 0) end,
    case when p.is_ghost_mode then null
         else public.compute_consistency_score_range(p.id, current_date - 29, current_date) end,
    p.is_ghost_mode
  from public.friendships f
  join public.profiles p on p.id = f.friend_id
  left join public.streaks s on s.user_id = p.id
  where f.user_id = auth.uid()
  order by p.name nulls last;
$$;

-- Incoming + outgoing requests WITH the other party's name/code (a plain client
-- join can't read other users' profiles rows under RLS).
create or replace function public.get_friend_requests()
returns table (
  id uuid, direction text, other_user_id uuid, other_name text, other_code text,
  status text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, 'incoming'::text, r.from_user_id, p.name, p.friend_code, r.status, r.created_at
  from public.friend_requests r join public.profiles p on p.id = r.from_user_id
  where r.to_user_id = auth.uid() and r.status = 'pending'
  union all
  select r.id, 'outgoing'::text, r.to_user_id, p.name, p.friend_code, r.status, r.created_at
  from public.friend_requests r join public.profiles p on p.id = r.to_user_id
  where r.from_user_id = auth.uid() and r.status = 'pending'
  order by created_at desc;
$$;

-- Streak leaderboard: friends + self, ghosts excluded, ranked by current streak.
create or replace function public.leaderboard_streak()
returns table (user_id uuid, friend_code text, name text, value integer, rank integer)
language sql
stable
security definer
set search_path = public
as $$
  with ids as (
    select friend_id as id from public.friendships where user_id = auth.uid()
    union select auth.uid()
  ),
  rows as (
    select p.id, p.friend_code, p.name, coalesce(s.current_streak_count, 0) as value
    from public.profiles p
    left join public.streaks s on s.user_id = p.id
    where p.id in (select id from ids) and p.is_ghost_mode = false
  )
  select id, friend_code, name, value, rank() over (order by value desc)::integer
  from rows order by rank, name;
$$;

-- Consistency leaderboard for a period: 'weekly' | 'monthly' | 'all_time'.
create or replace function public.leaderboard_consistency(p_period text)
returns table (user_id uuid, friend_code text, name text, value integer, rank integer)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select case p_period
      when 'weekly'  then current_date - 6
      when 'monthly' then current_date - 29
      else '2020-01-01'::date
    end as start_date
  ),
  ids as (
    select friend_id as id from public.friendships where user_id = auth.uid()
    union select auth.uid()
  ),
  rows as (
    select p.id, p.friend_code, p.name,
      public.compute_consistency_score_range(p.id, (select start_date from bounds), current_date) as value
    from public.profiles p
    where p.id in (select id from ids) and p.is_ghost_mode = false
  )
  select id, friend_code, name, value, rank() over (order by value desc)::integer
  from rows order by rank, name;
$$;

-- ── 6. Write APIs (all auth.uid()-scoped, atomic) ───────────────────────────

-- Returns a status string the client maps to a message. Enforces the 20/day
-- rate limit server-side so it can't be bypassed.
create or replace function public.send_friend_request(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  sent_today int;
begin
  if me is null then return 'unauthenticated'; end if;

  select id into target from public.profiles where friend_code = upper(trim(p_code)) limit 1;
  if target is null then return 'not_found'; end if;
  if target = me then return 'self'; end if;

  if exists (select 1 from public.friendships where user_id = me and friend_id = target) then
    return 'already_friends';
  end if;

  select count(*) into sent_today from public.friend_requests
    where from_user_id = me and created_at > now() - interval '1 day';
  if sent_today >= 20 then return 'rate_limited'; end if;

  -- If they already requested us, accept it instead of creating a mirror row.
  if exists (select 1 from public.friend_requests
             where from_user_id = target and to_user_id = me and status = 'pending') then
    perform public.accept_friend_request(
      (select id from public.friend_requests where from_user_id = target and to_user_id = me and status = 'pending'));
    return 'accepted_mutual';
  end if;

  insert into public.friend_requests (from_user_id, to_user_id, status)
  values (me, target, 'pending')
  on conflict (from_user_id, to_user_id) do update set status = 'pending', created_at = now(), responded_at = null;
  return 'sent';
end;
$$;

create or replace function public.accept_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.friend_requests%rowtype;
begin
  select * into req from public.friend_requests where id = p_request_id;
  if not found or req.to_user_id <> auth.uid() then
    raise exception 'not allowed';
  end if;

  update public.friend_requests set status = 'accepted', responded_at = now() where id = p_request_id;

  insert into public.friendships (user_id, friend_id) values (req.to_user_id, req.from_user_id)
    on conflict do nothing;
  insert into public.friendships (user_id, friend_id) values (req.from_user_id, req.to_user_id)
    on conflict do nothing;
end;
$$;

create or replace function public.decline_friend_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.friend_requests set status = 'declined', responded_at = now()
  where id = p_request_id and to_user_id = auth.uid();
end;
$$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.friend_requests set status = 'cancelled', responded_at = now()
  where id = p_request_id and from_user_id = auth.uid();
end;
$$;

create or replace function public.remove_friend(p_friend_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.friendships
  where (user_id = auth.uid() and friend_id = p_friend_id)
     or (user_id = p_friend_id and friend_id = auth.uid());
end;
$$;

-- ── 7. Referral qualification ───────────────────────────────────────────────
-- Per-user variant for the "run on app foreground" beta approach.
create or replace function public.check_referral_qualifications_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Qualify: referred user logged meals on >= 7 distinct days AND finished onboarding.
  update public.referrals r
  set status = 'qualified', qualified_at = now()
  where r.referrer_id = p_user_id and r.status = 'pending' and r.referred_id is not null
    and exists (select 1 from public.profiles p where p.id = r.referred_id and p.onboarding_complete = true)
    and (
      select count(distinct m.occurred_at_local::date) from public.meals m
      where m.user_id = r.referred_id and m.occurred_at_utc >= r.referred_signed_up_at
    ) >= 7;

  -- Expire pending referrals older than 30 days.
  update public.referrals
  set status = 'expired'
  where referrer_id = p_user_id and status = 'pending'
    and referred_signed_up_at < now() - interval '30 days';

  -- Award 1 month Pro when 10+ have qualified, capped at one reward per calendar month.
  if (select count(*) from public.referrals
      where referrer_id = p_user_id and status = 'qualified' and coalesce(suspicion_flag, false) = false) >= 10
     and not exists (
       select 1 from public.pro_rewards
       where user_id = p_user_id and reason = 'referral_10_friends'
         and date_trunc('month', granted_at) = date_trunc('month', now())
     )
  then
    insert into public.pro_rewards (user_id, reason, expires_at)
    values (p_user_id, 'referral_10_friends', now() + interval '30 days');
  end if;
end;
$$;

-- Global sweep (schedule via pg_cron; safe to also leave unscheduled for beta).
create or replace function public.check_referral_qualifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare rid uuid;
begin
  for rid in select distinct referrer_id from public.referrals where status = 'pending' loop
    perform public.check_referral_qualifications_for_user(rid);
  end loop;
end;
$$;

-- ── 8. EXECUTE grants ───────────────────────────────────────────────────────
-- Lock everything to the authenticated role; nothing here should be anon/public.
revoke execute on function
  public.find_user_by_friend_code(text), public.get_friends(), public.get_friend_requests(),
  public.leaderboard_streak(), public.leaderboard_consistency(text),
  public.send_friend_request(text), public.accept_friend_request(uuid),
  public.decline_friend_request(uuid), public.cancel_friend_request(uuid),
  public.remove_friend(uuid), public.check_referral_qualifications_for_user(uuid),
  public.compute_consistency_score_range(uuid, date, date)
from public;

grant execute on function
  public.find_user_by_friend_code(text), public.get_friends(), public.get_friend_requests(),
  public.leaderboard_streak(), public.leaderboard_consistency(text),
  public.send_friend_request(text), public.accept_friend_request(uuid),
  public.decline_friend_request(uuid), public.cancel_friend_request(uuid),
  public.remove_friend(uuid), public.check_referral_qualifications_for_user(uuid)
to authenticated;

-- Internal-only functions stay off the API surface.
revoke execute on function public.check_referral_qualifications() from public, anon, authenticated;
revoke execute on function public.generate_friend_code() from public, anon, authenticated;
