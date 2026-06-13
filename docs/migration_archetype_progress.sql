-- Supabase Migration: Add Archetype Progress System
-- Run this in the Supabase SQL Editor

-- Add archetype_progress and archetype_level columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS archetype_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS archetype_level TEXT DEFAULT 'pup';

-- Add check constraint for valid progress range
ALTER TABLE profiles
ADD CONSTRAINT archetype_progress_range 
CHECK (archetype_progress >= 0 AND archetype_progress <= 100);

-- Add check constraint for valid level values
ALTER TABLE profiles
ADD CONSTRAINT archetype_level_valid 
CHECK (archetype_level IN ('pup', 'base', 'alpha', 'legend'));

-- Update existing profiles to have default values
UPDATE profiles 
SET archetype_progress = 0, archetype_level = 'pup'
WHERE archetype_progress IS NULL OR archetype_level IS NULL;
