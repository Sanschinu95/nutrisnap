-- Per-user daily scan usage, mirroring coach_usage_daily. The scan-analyze
-- Edge Function upserts this row to cap how many vision calls a single user
-- can make per day (the scan/estimate Groq key pool is the expensive one and
-- previously had no per-user limit). RLS lets a user read their own count.
--
-- Only the service-role Edge Function should insert/update — no client policy
-- for those verbs is defined.

CREATE TABLE IF NOT EXISTS scan_usage_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE scan_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own scan usage" ON scan_usage_daily;
CREATE POLICY "Users can read own scan usage"
  ON scan_usage_daily FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policies for the authenticated role — those
-- operations only succeed via the Edge Function's service-role client.
