-- NutriSnap V1 core engine/schema migration
-- Additive migration: preserves existing food_entries/daily_summaries data.

create extension if not exists "uuid-ossp";
create extension if not exists pg_cron;

alter table public.profiles
  add column if not exists unit_preference text default 'metric'
    check (unit_preference in ('metric', 'imperial')),
  add column if not exists activity_tier text
    check (activity_tier in ('low', 'moderate', 'high')),
  add column if not exists hydration_goal_ml integer;

create table if not exists public.meals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  occurred_at_local timestamp not null,
  occurred_at_utc timestamptz not null,
  total_calories integer not null default 0,
  total_protein decimal(7,2) not null default 0,
  total_carbs decimal(7,2) not null default 0,
  total_fat decimal(7,2) not null default 0,
  source text not null check (source in ('scan', 'manual')),
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.food_items (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid references public.meals(id) on delete cascade not null,
  name text not null,
  calories integer not null default 0,
  protein decimal(7,2) not null default 0,
  carbs decimal(7,2) not null default 0,
  fat decimal(7,2) not null default 0,
  portion_size_tier text check (portion_size_tier in ('small', 'medium', 'large')),
  grams decimal(7,2),
  created_at timestamptz default now()
);

create table if not exists public.scan_feedback (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid references public.meals(id) on delete cascade not null,
  food_item_id uuid references public.food_items(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  raw_model_prediction jsonb not null default '{}'::jsonb,
  user_corrected_values jsonb,
  feedback_type text not null check (feedback_type in ('thumbs_up', 'thumbs_down', 'edited')),
  created_at timestamptz default now()
);

create table if not exists public.hydration_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount_ml integer not null check (amount_ml > 0),
  source text not null check (source in ('notification_quick_add', 'in_app')),
  occurred_at_local timestamp not null,
  occurred_at_utc timestamptz not null
);

create table if not exists public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak_count integer not null default 0,
  last_logged_date date,
  grace_days_used_this_week integer not null default 0,
  updated_at timestamptz default now()
);

create table if not exists public.vacation_periods (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now(),
  check (end_date >= start_date),
  check (start_date >= current_date)
);

create table if not exists public.consistency_scores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  period_start date not null,
  period_end date not null,
  score decimal(5,4) not null,
  meals_logged_rate decimal(5,4) not null,
  hydration_logged_rate decimal(5,4) not null,
  days_active_rate decimal(5,4) not null,
  created_at timestamptz default now(),
  unique(user_id, period_start, period_end)
);

create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  event_name text not null,
  user_id uuid references public.profiles(id) on delete set null,
  occurred_at_local timestamp not null,
  occurred_at_utc timestamptz not null,
  properties jsonb not null default '{}'::jsonb,
  app_version text,
  platform text
);

create table if not exists public.admins (
  user_id uuid primary key,
  created_at timestamptz default now()
);

create table if not exists public.daily_active_users (
  date date primary key,
  active_users integer not null default 0,
  updated_at timestamptz default now()
);

create table if not exists public.feature_usage_daily (
  date date not null,
  event_name text not null,
  event_count integer not null default 0,
  unique(date, event_name)
);

create table if not exists public.notification_open_rate_daily (
  date date primary key,
  received_count integer not null default 0,
  opened_count integer not null default 0,
  open_rate decimal(7,4) not null default 0
);

insert into public.meals (
  id, user_id, occurred_at_local, occurred_at_utc, total_calories,
  total_protein, total_carbs, total_fat, source, image_url, created_at, updated_at
)
select
  fe.id,
  fe.user_id,
  (fe.logged_at at time zone 'UTC')::timestamp,
  fe.logged_at,
  fe.total_calories,
  coalesce(fe.protein_g, 0),
  coalesce(fe.carbs_g, 0),
  coalesce(fe.fat_g, 0),
  'scan',
  fe.image_url,
  fe.logged_at,
  fe.logged_at
from public.food_entries fe
where not exists (select 1 from public.meals m where m.id = fe.id);

insert into public.food_items (meal_id, name, calories, protein, carbs, fat, portion_size_tier, grams)
select
  fe.id,
  coalesce(item->>'name', fe.meal_name),
  coalesce((item->>'calories')::integer, 0),
  coalesce((item->>'protein_g')::decimal, 0),
  coalesce((item->>'carbs_g')::decimal, 0),
  coalesce((item->>'fat_g')::decimal, 0),
  case when item->>'portion_size_tier' in ('small', 'medium', 'large') then item->>'portion_size_tier' end,
  nullif(regexp_replace(coalesce(item->>'quantity', ''), '[^0-9.]', '', 'g'), '')::decimal
from public.food_entries fe
cross join lateral jsonb_array_elements(fe.food_items) as item
where not exists (select 1 from public.food_items fi where fi.meal_id = fe.id);

insert into public.streaks (user_id, current_streak_count, last_logged_date)
select id, coalesce(streak_count, 0), last_logged_date
from public.profiles
where not exists (select 1 from public.streaks s where s.user_id = profiles.id);

create index if not exists idx_meals_user_time on public.meals(user_id, occurred_at_utc);
create index if not exists idx_food_items_meal on public.food_items(meal_id);
create index if not exists idx_scan_feedback_meal on public.scan_feedback(meal_id);
create index if not exists idx_hydration_logs_user_time on public.hydration_logs(user_id, occurred_at_utc);
create index if not exists idx_vacation_periods_user_dates on public.vacation_periods(user_id, start_date, end_date);
create index if not exists idx_events_name_time on public.events(event_name, occurred_at_utc);
create index if not exists idx_events_user on public.events(user_id);

alter table public.meals enable row level security;
alter table public.food_items enable row level security;
alter table public.scan_feedback enable row level security;
alter table public.hydration_logs enable row level security;
alter table public.streaks enable row level security;
alter table public.vacation_periods enable row level security;
alter table public.consistency_scores enable row level security;
alter table public.events enable row level security;
alter table public.admins enable row level security;

create policy "Users can manage own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage own food items" on public.food_items
  for all using (
    exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid())
  );

create policy "Users can manage own scan feedback" on public.scan_feedback
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can manage own hydration logs" on public.hydration_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own streak" on public.streaks
  for select using (auth.uid() = user_id);
create policy "Users can upsert own streak" on public.streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage own vacations" on public.vacation_periods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own consistency scores" on public.consistency_scores
  for select using (auth.uid() = user_id);

create policy "Users can insert own events" on public.events
  for insert with check (auth.uid() = user_id);

create policy "Users can view own admin row" on public.admins
  for select using (auth.uid() = user_id);

create or replace function public.anonymize_scan_feedback_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.scan_feedback
  set user_id = null
  where user_id = target_user_id;
end;
$$;

create or replace function public.export_user_data(target_user_id uuid)
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = target_user_id),
    'weights', coalesce((select jsonb_agg(to_jsonb(w) order by w.logged_at) from public.weight_logs w where w.user_id = target_user_id), '[]'::jsonb),
    'meals', coalesce((
      select jsonb_agg(
        to_jsonb(m) || jsonb_build_object(
          'food_items',
          coalesce((select jsonb_agg(to_jsonb(fi)) from public.food_items fi where fi.meal_id = m.id), '[]'::jsonb)
        )
        order by m.occurred_at_utc
      )
      from public.meals m
      where m.user_id = target_user_id
    ), '[]'::jsonb),
    'hydration_logs', coalesce((select jsonb_agg(to_jsonb(h) order by h.occurred_at_utc) from public.hydration_logs h where h.user_id = target_user_id), '[]'::jsonb),
    'streak', (select to_jsonb(s) from public.streaks s where s.user_id = target_user_id)
  );
$$;

create or replace function public.refresh_event_rollups()
returns void
language plpgsql
security definer
as $$
begin
  insert into public.daily_active_users(date, active_users, updated_at)
  select occurred_at_utc::date, count(distinct user_id), now()
  from public.events
  where user_id is not null
  group by occurred_at_utc::date
  on conflict (date) do update set active_users = excluded.active_users, updated_at = now();

  insert into public.feature_usage_daily(date, event_name, event_count)
  select occurred_at_utc::date, event_name, count(*)
  from public.events
  group by occurred_at_utc::date, event_name
  on conflict (date, event_name) do update set event_count = excluded.event_count;

  insert into public.notification_open_rate_daily(date, received_count, opened_count, open_rate)
  select
    date,
    received_count,
    opened_count,
    case when received_count = 0 then 0 else opened_count::decimal / received_count end
  from (
    select
      occurred_at_utc::date as date,
      count(*) filter (where event_name = 'notification_received') as received_count,
      count(*) filter (where event_name = 'notification_opened') as opened_count
    from public.events
    where event_name in ('notification_received', 'notification_opened')
    group by occurred_at_utc::date
  ) daily
  on conflict (date) do update
  set received_count = excluded.received_count,
      opened_count = excluded.opened_count,
      open_rate = excluded.open_rate;
end;
$$;

select cron.schedule(
  'nutrisnap-refresh-event-rollups',
  '15 * * * *',
  $$select public.refresh_event_rollups();$$
)
where not exists (
  select 1 from cron.job where jobname = 'nutrisnap-refresh-event-rollups'
);
