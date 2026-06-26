/**
 * Database type definitions
 * These match the SQL schema in docs/schema.sql
 */

import type { ArchetypeKey, ArchetypeTier, BiologicalSex, GoalType } from './archetype';
import type {
  FeedbackType,
  FoodItem,
  HydrationSource,
  MealSource,
  PortionSizeTier,
  UserCorrection,
  NutritionEntry,
} from './nutrition';
import type { UnitPreference } from '@/lib/nutritionEngine';

export interface DietaryPreferences {
  allergies?: string[];
  diets?: string[];
  custom?: string[];
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      meals: {
        Row: MealRow;
        Insert: MealInsert;
        Update: MealUpdate;
      };
      food_items: {
        Row: FoodItemRow;
        Insert: FoodItemInsert;
        Update: FoodItemUpdate;
      };
      scan_feedback: {
        Row: ScanFeedbackRow;
        Insert: ScanFeedbackInsert;
        Update: ScanFeedbackUpdate;
      };
      hydration_logs: {
        Row: HydrationLogRow;
        Insert: HydrationLogInsert;
        Update: HydrationLogUpdate;
      };
      streaks: {
        Row: StreakRow;
        Insert: StreakInsert;
        Update: StreakUpdate;
      };
      vacation_periods: {
        Row: VacationPeriodRow;
        Insert: VacationPeriodInsert;
        Update: VacationPeriodUpdate;
      };
      consistency_scores: {
        Row: ConsistencyScoreRow;
        Insert: ConsistencyScoreInsert;
        Update: ConsistencyScoreUpdate;
      };
      events: {
        Row: EventRow;
        Insert: EventInsert;
        Update: EventUpdate;
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
  unit_preference: UnitPreference;
  activity_tier: 'low' | 'moderate' | 'high' | null;
  hydration_goal_ml: number | null;
  calorie_goal: number | null;
  protein_goal: number | null;
  carb_goal: number | null;
  fat_goal: number | null;
  archetype: ArchetypeKey | null;
  archetype_tier: ArchetypeTier;
  archetype_progress: number;
  archetype_level: string;
  dietary_preferences: DietaryPreferences | null;
  streak_count: number;
  longest_streak: number;
  last_logged_date: string | null;
  onboarding_complete: boolean;
  feedback_submitted: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Partial<Profile> & { id: string };
export type ProfileUpdate = Partial<Profile>;

// Canonical Meals
export interface MealRow {
  id: string;
  user_id: string;
  occurred_at_local: string;
  occurred_at_utc: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  source: MealSource;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type MealInsert = Omit<MealRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type MealUpdate = Partial<MealRow>;

export interface FoodItemRow {
  id: string;
  meal_id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion_size_tier: PortionSizeTier | null;
  grams: number | null;
  created_at: string;
}

export type FoodItemInsert = Omit<FoodItemRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type FoodItemUpdate = Partial<FoodItemRow>;

export interface ScanFeedbackRow {
  id: string;
  meal_id: string;
  food_item_id: string | null;
  raw_model_prediction: Record<string, unknown>;
  user_corrected_values: Record<string, unknown> | null;
  feedback_type: FeedbackType;
  created_at: string;
}

export type ScanFeedbackInsert = Omit<ScanFeedbackRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ScanFeedbackUpdate = Partial<ScanFeedbackRow>;

export interface HydrationLogRow {
  id: string;
  user_id: string;
  amount_ml: number;
  source: HydrationSource;
  occurred_at_local: string;
  occurred_at_utc: string;
}

export type HydrationLogInsert = Omit<HydrationLogRow, 'id'> & { id?: string };
export type HydrationLogUpdate = Partial<HydrationLogRow>;

export interface StreakRow {
  user_id: string;
  current_streak_count: number;
  last_logged_date: string | null;
  grace_days_used_this_week: number;
  updated_at: string;
}

export type StreakInsert = Omit<StreakRow, 'updated_at'> & { updated_at?: string };
export type StreakUpdate = Partial<StreakRow>;

export interface VacationPeriodRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export type VacationPeriodInsert = Omit<VacationPeriodRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};
export type VacationPeriodUpdate = Partial<VacationPeriodRow>;

export interface ConsistencyScoreRow {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  score: number;
  meals_logged_rate: number;
  hydration_logged_rate: number;
  days_active_rate: number;
  created_at: string;
}

export type ConsistencyScoreInsert = Omit<ConsistencyScoreRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};
export type ConsistencyScoreUpdate = Partial<ConsistencyScoreRow>;

export interface EventRow {
  id: string;
  event_name: string;
  user_id: string | null;
  occurred_at_local: string;
  occurred_at_utc: string;
  properties: Record<string, unknown>;
  app_version: string | null;
  platform: string | null;
}

export type EventInsert = Omit<EventRow, 'id'> & { id?: string };
export type EventUpdate = Partial<EventRow>;

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
  source?: MealSource;
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
