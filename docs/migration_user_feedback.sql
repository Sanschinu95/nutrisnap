-- User-submitted feedback (bug reports, feature requests, support contacts).
-- Auth users insert their own rows; reading is limited to their own rows.
-- Status moves to in_progress / resolved / closed in the admin tooling, not
-- from the client.

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug_report', 'feature_request', 'contact_support')),
  title TEXT,
  description TEXT NOT NULL,
  device_info JSONB,
  screenshot_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit feedback"
  ON user_feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own feedback"
  ON user_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users cannot modify feedback"
  ON user_feedback FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Users cannot delete feedback"
  ON user_feedback FOR DELETE
  TO authenticated
  USING (false);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status);
