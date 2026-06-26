-- Training data for ML fine-tuning
-- Completely independent from meals/food_items tables
-- No foreign keys to any other table

CREATE TABLE IF NOT EXISTS training_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Image reference (Cloudinary URL, copied at write time, not a FK)
  image_url TEXT NOT NULL,

  -- What the AI predicted
  ai_food_name TEXT,
  ai_calories REAL,
  ai_protein_g REAL,
  ai_carbs_g REAL,
  ai_fat_g REAL,
  ai_raw_response JSONB,          -- full raw model output for debugging

  -- What the user said (null if user confirmed AI was correct)
  user_food_name TEXT,
  user_calories REAL,
  user_protein_g REAL,
  user_carbs_g REAL,
  user_fat_g REAL,

  -- Feedback signal
  feedback_type TEXT NOT NULL DEFAULT 'none'
    CHECK (feedback_type IN ('confirmed', 'corrected', 'rejected', 'none')),
  -- 'confirmed' = user tapped thumbs up (AI was right)
  -- 'corrected' = user edited the values (AI was wrong, user fixed it)
  -- 'rejected'  = user tapped thumbs down but didn't provide corrections
  -- 'none'      = user just saved without giving feedback

  -- Metadata
  source TEXT DEFAULT 'scan' CHECK (source IN ('scan', 'manual')),
  -- 'scan' entries have both AI and (optionally) user values → useful for training
  -- 'manual' entries have only user values, no AI prediction → still useful as ground truth

  device_locale TEXT,              -- helps identify regional food patterns
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- De-identification: this gets set to NULL on account deletion
  -- While it exists, it's only used to count unique contributors, never to identify
  contributor_id UUID
);

-- Index for bulk export queries
CREATE INDEX IF NOT EXISTS idx_training_data_feedback ON training_data(feedback_type);
CREATE INDEX IF NOT EXISTS idx_training_data_created ON training_data(created_at);

-- RLS: app can insert own rows, never read/update/delete
-- Only service-role (admin/export scripts) can read
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert training data" ON training_data;
CREATE POLICY "Users can insert training data"
  ON training_data FOR INSERT
  TO authenticated
  WITH CHECK (contributor_id = auth.uid());

DROP POLICY IF EXISTS "Users cannot read training data" ON training_data;
CREATE POLICY "Users cannot read training data"
  ON training_data FOR SELECT
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Users cannot update training data" ON training_data;
CREATE POLICY "Users cannot update training data"
  ON training_data FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Users cannot delete training data" ON training_data;
CREATE POLICY "Users cannot delete training data"
  ON training_data FOR DELETE
  TO authenticated
  USING (false);

-- For account deletion: nullify contributor_id but keep the row
CREATE OR REPLACE FUNCTION nullify_training_contributor()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE training_data SET contributor_id = NULL WHERE contributor_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Server-side RPC the client can call to de-identify its own training rows
-- during account deletion. SECURITY DEFINER bypasses the SELECT/UPDATE-blocking
-- RLS policies above, but only for the caller's own contributor_id.
CREATE OR REPLACE FUNCTION public.nullify_training_for_self()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;
  UPDATE training_data SET contributor_id = NULL WHERE contributor_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.nullify_training_for_self() TO authenticated;

-- Attach to auth.users deletion (adjust if your deletion flow differs)
-- Note: This trigger may need to be created via Supabase dashboard if
-- your migration runner doesn't have access to the auth schema
