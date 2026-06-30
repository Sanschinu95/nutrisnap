-- Streaks v2: milestones + visible grace days.
--
-- Adds columns alongside the existing `current_streak_count` /
-- `grace_days_used_this_week` (left in place for backward compat). The new
-- `grace_days_used` JSONB stores explicit ISO dates so we can show "Grace
-- day used on Tuesday" in the UI instead of an opaque counter.

ALTER TABLE streaks ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE streaks ADD COLUMN IF NOT EXISTS grace_days_used JSONB DEFAULT '[]'::jsonb;
ALTER TABLE streaks ADD COLUMN IF NOT EXISTS milestones_reached JSONB DEFAULT '[]'::jsonb;
ALTER TABLE streaks ADD COLUMN IF NOT EXISTS last_meal_logged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_streaks_user ON streaks(user_id);

-- Per-user streak preferences.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_reminders_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS milestone_notifications_enabled BOOLEAN DEFAULT TRUE;
