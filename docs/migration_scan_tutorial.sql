-- First-time scan tutorial: one-time onboarding shown when the user opens
-- the Scan tab for the first time. Persisted on the profile so signing out
-- and back in on the same device doesn't re-trigger it. Users can flip
-- this back to FALSE from Settings ("Show scan tips again").

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_scan_tutorial BOOLEAN DEFAULT FALSE;
