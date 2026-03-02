/**
 * Nutrition-related type definitions
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Individual food item from Gemini analysis
export interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: ConfidenceLevel;
}

// Complete nutrition entry from Gemini analysis
export interface NutritionEntry {
  meal_name: string;
  food_items: FoodItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  notes?: string;
}

// Error response from Gemini
export interface GeminiErrorResponse {
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
