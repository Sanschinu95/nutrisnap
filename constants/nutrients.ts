/**
 * Nutrient calculation constants
 */

// Calories per gram of each macronutrient
export const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
  fiber: 2, // approximate
  alcohol: 7,
} as const;

// Daily recommended values (general guidelines)
export const DAILY_RECOMMENDED = {
  fiber: 25, // grams
  sodium: 2300, // mg
  sugar: 25, // grams (added sugar limit)
  water: 2000, // ml
} as const;

// Water cup/glass size in ml
export const WATER_GLASS_ML = 250;

// Default activity multipliers for TDEE calculation
export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,       // Little or no exercise
  light: 1.375,         // Light exercise 1-3 days/week
  moderate: 1.55,       // Moderate exercise 3-5 days/week
  active: 1.725,        // Hard exercise 6-7 days/week
  veryActive: 1.9,      // Very hard exercise, physical job
} as const;

// Goal calorie adjustments (keys match SQL enum: 'cut', 'maintain', 'bulk')
export const GOAL_CALORIE_ADJUSTMENTS: Record<import('@/types/archetype').GoalType, number> = {
  cut: -500,         // 500 calorie deficit for ~1lb/week loss
  maintain: 0,
  bulk: 300,         // 300 calorie surplus for lean gains
} as const;

// Macro gram calculations from percentage and total calories
export function calculateMacroGrams(
  totalCalories: number,
  proteinPercent: number,
  carbPercent: number,
  fatPercent: number
): { proteinGrams: number; carbGrams: number; fatGrams: number } {
  const proteinCalories = totalCalories * proteinPercent;
  const carbCalories = totalCalories * carbPercent;
  const fatCalories = totalCalories * fatPercent;

  return {
    proteinGrams: Math.round(proteinCalories / CALORIES_PER_GRAM.protein),
    carbGrams: Math.round(carbCalories / CALORIES_PER_GRAM.carbs),
    fatGrams: Math.round(fatCalories / CALORIES_PER_GRAM.fat),
  };
}

// Calculate total calories from macros
export function calculateTotalCalories(
  proteinGrams: number,
  carbGrams: number,
  fatGrams: number
): number {
  return Math.round(
    proteinGrams * CALORIES_PER_GRAM.protein +
    carbGrams * CALORIES_PER_GRAM.carbs +
    fatGrams * CALORIES_PER_GRAM.fat
  );
}

// Food categories for FoodMap
export const FOOD_CATEGORIES = [
  { key: 'all', label: 'All', icon: '🍽️' },
  { key: 'fruits', label: 'Fruits', icon: '🍎' },
  { key: 'grains', label: 'Grains', icon: '🌾' },
  { key: 'proteins', label: 'Proteins', icon: '🥩' },
  { key: 'dairy', label: 'Dairy', icon: '🥛' },
  { key: 'snacks', label: 'Snacks', icon: '🍪' },
  { key: 'drinks', label: 'Drinks', icon: '🥤' },
  { key: 'other', label: 'Other', icon: '🍱' },
] as const;

export type FoodCategory = typeof FOOD_CATEGORIES[number]['key'];
