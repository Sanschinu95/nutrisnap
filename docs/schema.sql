-- NutriSnap Database Schema
-- Run this in your Neon SQL Editor (https://neon.tech)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  name text,
  age integer,
  weight_kg decimal(5,2),
  height_cm decimal(5,2),
  goal_weight_kg decimal(5,2),
  goal_type text check (goal_type in ('cut', 'maintain', 'bulk')),
  biological_sex text check (biological_sex in ('male', 'female', 'prefer_not_to_say')),
  calorie_goal integer,
  protein_goal integer,
  carb_goal integer,
  fat_goal integer,
  archetype text check (archetype in ('wolf', 'bear', 'lion', 'deer', 'tigress', 'phoenix', 'doe', 'lioness')),
  archetype_tier text default 'base' check (archetype_tier in ('base', 'silver', 'gold', 'platinum')),
  streak_count integer default 0,
  longest_streak integer default 0,
  last_logged_date date,
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Food entries table
create table if not exists public.food_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  meal_name text not null,
  food_items jsonb not null default '[]'::jsonb,
  total_calories integer not null,
  protein_g decimal(6,2),
  carbs_g decimal(6,2),
  fat_g decimal(6,2),
  fiber_g decimal(6,2),
  image_url text,
  raw_gemini_response jsonb,
  user_corrections jsonb,
  user_accepted_without_edit boolean default true,
  is_cheat_day boolean default false,
  logged_at timestamptz default now()
);

-- Daily summaries table (aggregated daily data)
create table if not exists public.daily_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  total_calories integer default 0,
  total_protein decimal(6,2) default 0,
  total_carbs decimal(6,2) default 0,
  total_fat decimal(6,2) default 0,
  water_ml integer default 0,
  is_cheat_day boolean default false,
  goal_met boolean default false,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- Weight logs table
create table if not exists public.weight_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  weight_kg decimal(5,2) not null,
  logged_at timestamptz default now()
);

-- FoodMap entries (unique foods scanned by user)
create table if not exists public.foodmap_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  food_name text not null,
  category text default 'other',
  avg_calories decimal(6,2),
  avg_protein_g decimal(6,2),
  avg_carbs_g decimal(6,2),
  avg_fat_g decimal(6,2),
  times_scanned integer default 1,
  first_scanned timestamptz default now(),
  last_scanned timestamptz default now(),
  unique(user_id, food_name)
);

-- Habits table
create table if not exists public.habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  emoji text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Habit completions table
create table if not exists public.habit_completions (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references public.habits(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  completed_at date not null,
  unique(habit_id, completed_at)
);

-- Social waitlist (for upcoming feature)
create table if not exists public.social_waitlist (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  created_at timestamptz default now()
);

-- Create indexes for better query performance
create index if not exists idx_food_entries_user_date on public.food_entries(user_id, logged_at);
create index if not exists idx_daily_summaries_user_date on public.daily_summaries(user_id, date);
create index if not exists idx_weight_logs_user_date on public.weight_logs(user_id, logged_at);
create index if not exists idx_foodmap_user on public.foodmap_entries(user_id);
create index if not exists idx_habits_user on public.habits(user_id);
create index if not exists idx_habit_completions_habit on public.habit_completions(habit_id, completed_at);

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.food_entries enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.weight_logs enable row level security;
alter table public.foodmap_entries enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.social_waitlist enable row level security;

-- RLS Policies: Users can only access their own data
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Food entries policies
create policy "Users can view own food entries"
  on public.food_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own food entries"
  on public.food_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own food entries"
  on public.food_entries for update
  using (auth.uid() = user_id);

create policy "Users can delete own food entries"
  on public.food_entries for delete
  using (auth.uid() = user_id);

-- Daily summaries policies
create policy "Users can view own daily summaries"
  on public.daily_summaries for select
  using (auth.uid() = user_id);

create policy "Users can insert own daily summaries"
  on public.daily_summaries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own daily summaries"
  on public.daily_summaries for update
  using (auth.uid() = user_id);

-- Weight logs policies
create policy "Users can view own weight logs"
  on public.weight_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own weight logs"
  on public.weight_logs for insert
  with check (auth.uid() = user_id);

-- FoodMap policies
create policy "Users can view own foodmap entries"
  on public.foodmap_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own foodmap entries"
  on public.foodmap_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own foodmap entries"
  on public.foodmap_entries for update
  using (auth.uid() = user_id);

-- Habits policies
create policy "Users can view own habits"
  on public.habits for select
  using (auth.uid() = user_id);

create policy "Users can insert own habits"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own habits"
  on public.habits for update
  using (auth.uid() = user_id);

create policy "Users can delete own habits"
  on public.habits for delete
  using (auth.uid() = user_id);

-- Habit completions policies  
create policy "Users can view own habit completions"
  on public.habit_completions for select
  using (auth.uid() = user_id);

create policy "Users can insert own habit completions"
  on public.habit_completions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own habit completions"
  on public.habit_completions for delete
  using (auth.uid() = user_id);

-- Social waitlist - anyone can insert
create policy "Anyone can join waitlist"
  on public.social_waitlist for insert
  with check (true);

-- Function to auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for profiles updated_at
create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
