/**
 * Nutrition-related type definitions
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Individual food item from Groq analysis
export interface FoodItem {
  id?: string;
  meal_id?: string;
  name: string;
  quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: ConfidenceLevel;
  portion_size_tier?: PortionSizeTier | null;
  grams?: number | null;
}

// Complete nutrition entry from Groq analysis
export interface NutritionEntry {
  meal_name: string;
  food_items: FoodItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  notes?: string;
}

// Error response from Groq
export interface GroqErrorResponse {
  error: 'no_food_detected' | 'analysis_failed' | 'network_error';
  message?: string;
}

// User correction tracking for AI improvement
export interface UserCorrection {
  field: string;
  from: string | number;
  to: string | number;
}

// Food entry as stored in database
export interface FoodEntry {
  id: string;
  user_id: string;
  occurred_at_local?: string;
  occurred_at_utc?: string;
  source?: MealSource;
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

// Daily summary
export interface DailySummary {
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

// FoodMap entry
export interface FoodMapEntry {
  id: string;
  user_id: string;
  food_name: string;
  category: string | null;
  times_scanned: number;
  avg_calories: number | null;
  first_scanned: string;
  last_scanned: string;
}

// Macro goals
export interface MacroGoals {
  protein: number;
  carbs: number;
  fat: number;
}

// Meal type
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealSource = 'scan' | 'manual';
export type PortionSizeTier = 'small' | 'medium' | 'large';
export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'edited';
export type HydrationSource = 'notification_quick_add' | 'in_app';

export interface Meal {
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

export interface ScanFeedback {
  id: string;
  meal_id: string;
  food_item_id: string | null;
  raw_model_prediction: Record<string, unknown>;
  user_corrected_values: Record<string, unknown> | null;
  feedback_type: FeedbackType;
  created_at: string;
}

export interface HydrationLog {
  id: string;
  user_id: string;
  amount_ml: number;
  source: HydrationSource;
  occurred_at_local: string;
  occurred_at_utc: string;
}
