/**
 * TDEE (Total Daily Energy Expenditure) and macro calculations
 * Using Mifflin-St Jeor equation
 */

import { ARCHETYPE_MACROS, type ArchetypeKey } from '@/constants/archetypes';
import { ACTIVITY_MULTIPLIERS, GOAL_CALORIE_ADJUSTMENTS, calculateMacroGrams } from '@/constants/nutrients';
import type { GoalType } from '@/types/archetype';

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 * @param weight - Weight in kilograms
 * @param height - Height in centimeters
 * @param age - Age in years
 * @param sex - Biological sex ('male' or 'female')
 * @returns BMR in calories per day
 */
export function calculateBMR(
  weight: number,
  height: number,
  age: number,
  sex: 'male' | 'female'
): number {
  if (sex === 'male') {
    // Men: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) + 5
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  // Women: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) - 161
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

/**
 * Calculate Total Daily Energy Expenditure
 * @param bmr - Basal Metabolic Rate
 * @param activityLevel - Activity multiplier (default: sedentary 1.2)
 * @returns TDEE in calories per day
 */
export function calculateTDEE(
  bmr: number,
  activityLevel: number = ACTIVITY_MULTIPLIERS.sedentary
): number {
  return Math.round(bmr * activityLevel);
}

/**
 * Calculate daily calorie goal based on TDEE and goal type
 * @param tdee - Total Daily Energy Expenditure
 * @param goal - User's goal ('lose_weight', 'maintain', or 'gain_muscle')
 * @returns Adjusted calorie goal
 */
export function calculateCalorieGoal(
  tdee: number,
  goal: GoalType
): number {
  const adjustment = GOAL_CALORIE_ADJUSTMENTS[goal];
  return Math.max(1200, tdee + adjustment); // Never go below 1200 calories
}

/**
 * Calculate all nutrition goals based on user data
 * @returns Complete nutrition goals including calories and macros
 */
/**
 * Map onboarding activity level (1-5) to TDEE multiplier
 */
function activityLevelToMultiplier(level: number): number {
  switch (level) {
    case 1: return ACTIVITY_MULTIPLIERS.sedentary;
    case 2: return ACTIVITY_MULTIPLIERS.light;
    case 3: return ACTIVITY_MULTIPLIERS.moderate;
    case 4: return ACTIVITY_MULTIPLIERS.active;
    case 5: return ACTIVITY_MULTIPLIERS.veryActive;
    default: return ACTIVITY_MULTIPLIERS.sedentary;
  }
}

export function calculateNutritionGoals(
  weight: number,
  height: number,
  age: number,
  sex: 'male' | 'female' | 'prefer_not_to_say',
  goal: GoalType,
  archetype: ArchetypeKey,
  activityLevel: number = 1
): {
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
  bmr: number;
  tdee: number;
} {
  // Use 'female' as default for 'prefer_not_to_say' (more conservative estimate)
  const calculationSex = sex === 'prefer_not_to_say' ? 'female' : sex;
  
  const bmr = calculateBMR(weight, height, age, calculationSex);
  const tdee = calculateTDEE(bmr, activityLevelToMultiplier(activityLevel));
  const calorieGoal = calculateCalorieGoal(tdee, goal);
  
  // Get macro percentages from archetype
  const macroSplit = ARCHETYPE_MACROS[archetype];
  const { proteinGrams, carbGrams, fatGrams } = calculateMacroGrams(
    calorieGoal,
    macroSplit.protein,
    macroSplit.carbs,
    macroSplit.fat
  );

  return {
    calorieGoal,
    proteinGoal: proteinGrams,
    carbGoal: carbGrams,
    fatGoal: fatGrams,
    bmr: Math.round(bmr),
    tdee,
  };
}

/**
 * Convert height between cm and feet/inches
 */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}

/**
 * Convert weight between kg and lbs
 */
export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462);
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.20462 * 10) / 10;
}
