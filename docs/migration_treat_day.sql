-- Treat Day: reward mechanic that unlocks every 5 consecutive logged days.
--
-- NOT a "cheat day" — wording matters; storage is similarly named.
--
-- Two-column "in-use" model: `used_at` is set when the user activates the
-- treat day, `used_date` is the LOCAL date they activated it on (used by
-- Home to detect "active today").  Unlocked-but-unused rows have both null.
-- Rows expire 14 days from unlock if not used.

CREATE TABLE IF NOT EXISTS treat_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  used_date DATE,
  unlock_reason TEXT,
  suggestions JSONB,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE treat_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own treat days" ON treat_days;
CREATE POLICY "Users manage own treat days" ON treat_days FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_treat_days_user ON treat_days(user_id);
CREATE INDEX IF NOT EXISTS idx_treat_days_unused
  ON treat_days(user_id, used_at) WHERE used_at IS NULL;

-- meals.source now accepts 'treat_day' so the selected indulgent item logs
-- as a meal AND keeps the streak alive.
ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_source_check;
ALTER TABLE meals ADD CONSTRAINT meals_source_check
  CHECK (source IN ('scan', 'manual', 'treat_day'));

-- Per-user preferences for the feature.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS treat_days_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS treat_day_notifications_enabled BOOLEAN DEFAULT TRUE;
