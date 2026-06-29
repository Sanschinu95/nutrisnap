-- Steps & sleep tracking: one row per day per user for steps, one per night
-- per user for sleep. Profile gets sleep-schedule + step-goal preference cols.
--
-- Steps source: 'pedometer' for live device counter, 'manual' for type-in.
-- Sleep source: 'confirmed' for one-tap morning prompt, 'manual' for direct
-- entry, 'edited' for an adjusted confirm.

CREATE TABLE IF NOT EXISTS steps_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  step_count INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'pedometer' CHECK (source IN ('pedometer', 'manual')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS sleep_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,  -- morning the user woke up
  sleep_time TIMESTAMPTZ NOT NULL,
  wake_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  source TEXT DEFAULT 'confirmed' CHECK (source IN ('confirmed', 'manual', 'edited')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS regular_sleep_time TIME DEFAULT '23:00';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS regular_wake_time TIME DEFAULT '07:00';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sleep_goal_hours REAL DEFAULT 8.0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS step_goal INTEGER DEFAULT 8000;

CREATE INDEX IF NOT EXISTS idx_steps_user_date ON steps_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sleep_user_date ON sleep_logs(user_id, date DESC);

ALTER TABLE steps_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own steps" ON steps_logs;
CREATE POLICY "Users manage own steps" ON steps_logs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own sleep" ON sleep_logs;
CREATE POLICY "Users manage own sleep" ON sleep_logs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DO $$ BEGIN
  ALTER TABLE steps_logs ADD CONSTRAINT steps_count_range CHECK (step_count >= 0 AND step_count <= 100000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sleep_logs ADD CONSTRAINT sleep_duration_range CHECK (duration_minutes >= 0 AND duration_minutes <= 960);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
