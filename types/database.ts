/**
 * Supabase database type definitions
 * These match the SQL schema exactly
 */

import type { ArchetypeKey, ArchetypeTier, BiologicalSex, GoalType } from './archetype';
import type { FoodItem, UserCorrection, NutritionEntry } from './nutrition';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      food_entries: {
        Row: FoodEntryRow;
        Insert: FoodEntryInsert;
        Update: FoodEntryUpdate;
      };
      daily_summaries: {
        Row: DailySummaryRow;
        Insert: DailySummaryInsert;
        Update: DailySummaryUpdate;
      };
      weight_logs: {
        Row: WeightLogRow;
        Insert: WeightLogInsert;
        Update: WeightLogUpdate;
      };
      foodmap_entries: {
        Row: FoodMapEntryRow;
        Insert: FoodMapEntryInsert;
        Update: FoodMapEntryUpdate;
      };
      habits: {
        Row: HabitRow;
        Insert: HabitInsert;
        Update: HabitUpdate;
      };
      habit_completions: {
        Row: HabitCompletionRow;
        Insert: HabitCompletionInsert;
        Update: HabitCompletionUpdate;
      };
      social_waitlist: {
        Row: SocialWaitlistRow;
        Insert: SocialWaitlistInsert;
        Update: SocialWaitlistUpdate;
      };
    };
  };
}

// Profiles
export interface Profile {
  id: string;
  name: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  goal_weight_kg: number | null;
  goal_type: GoalType | null;
  biological_sex: BiologicalSex | null;
  calorie_goal: number | null;
  protein_goal: number | null;
  carb_goal: number | null;
  fat_goal: number | null;
  archetype: ArchetypeKey | null;
  archetype_tier: ArchetypeTier;
  streak_count: number;
  longest_streak: number;
  last_logged_date: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Partial<Profile> & { id: string };
export type ProfileUpdate = Partial<Profile>;

// Food Entries
export interface FoodEntryRow {
  id: string;
  user_id: string;
  meal_name: string;
  food_items: FoodItem[];
  total_calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  image_url: string | null;
  raw_gemini_response: NutritionEntry | null;
  user_corrections: UserCorrection[] | null;
  user_accepted_without_edit: boolean;
  is_cheat_day: boolean;
  logged_at: string;
}

export type FoodEntryInsert = Omit<FoodEntryRow, 'id' | 'logged_at'> & {
  id?: string;
  logged_at?: string;
};

export type FoodEntryUpdate = Partial<FoodEntryRow>;

// Daily Summaries
export interface DailySummaryRow {
  id: string;
  user_id: string;
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  water_ml: number;
  is_cheat_day: boolean;
  goal_met: boolean;
}

export type DailySummaryInsert = Omit<DailySummaryRow, 'id'> & { id?: string };
export type DailySummaryUpdate = Partial<DailySummaryRow>;

// Weight Logs
export interface WeightLogRow {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
}

export type WeightLogInsert = Omit<WeightLogRow, 'id' | 'logged_at'> & {
  id?: string;
  logged_at?: string;
};

export type WeightLogUpdate = Partial<WeightLogRow>;

// FoodMap Entries
export interface FoodMapEntryRow {
  id: string;
  user_id: string;
  food_name: string;
  category: string | null;
  times_scanned: number;
  avg_calories: number | null;
  first_scanned: string;
  last_scanned: string;
}

export type FoodMapEntryInsert = Omit<FoodMapEntryRow, 'id' | 'first_scanned' | 'last_scanned'> & {
  id?: string;
  first_scanned?: string;
  last_scanned?: string;
};

export type FoodMapEntryUpdate = Partial<FoodMapEntryRow>;

// Habits
export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  target: string | null;
  is_active: boolean;
  created_at: string;
}

export type HabitInsert = Omit<HabitRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type HabitUpdate = Partial<HabitRow>;

// Habit Completions
export interface HabitCompletionRow {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string;
}

export type HabitCompletionInsert = Omit<HabitCompletionRow, 'id' | 'completed_at'> & {
  id?: string;
  completed_at?: string;
};

export type HabitCompletionUpdate = Partial<HabitCompletionRow>;

// Social Waitlist
export interface SocialWaitlistRow {
  id: string;
  email: string;
  created_at: string;
}

export type SocialWaitlistInsert = Omit<SocialWaitlistRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type SocialWaitlistUpdate = Partial<SocialWaitlistRow>;
