-- Per-user daily coach usage. The Edge Function upserts this row; RLS lets
-- the user read their own count so the UI can render "3 of 5 left" honestly
-- (as opposed to the trivially-bypassable AsyncStorage counter we had).
--
-- Only the service-role Edge Function should insert/update — no client
-- policy for those verbs is defined.

CREATE TABLE IF NOT EXISTS coach_usage_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE coach_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own coach usage" ON coach_usage_daily;
CREATE POLICY "Users can read own coach usage"
  ON coach_usage_daily FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policies for the authenticated role — those
-- operations only succeed via the Edge Function's service-role client.
