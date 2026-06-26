/**
 * Compatibility exports for nutrition target calculations.
 * New logic lives in nutritionEngine.ts and uses SI units internally.
 */

import type { ArchetypeKey } from '@/constants/archetypes';
import type { BiologicalSex, GoalType } from '@/types/archetype';
import {
  calculateBmrMifflinStJeor,
  calculateGoalCalorieTarget,
  calculateNutritionTargets,
  calculateTdeeFromBmr,
  cmToFeetInches,
  feetInchesToCm,
  kgToLbs,
  lbsToKg,
  mapOnboardingActivityToTier,
  type WeightLogInput,
} from './nutritionEngine';

export { cmToFeetInches, feetInchesToCm, kgToLbs, lbsToKg };

export function calculateBMR(
  weight: number,
  height: number,
  age: number,
  sex: 'male' | 'female',
): number {
  return calculateBmrMifflinStJeor(weight, height, age, sex);
}

export function calculateTDEE(bmr: number, activityMultiplier = 1.2): number {
  return Math.round(bmr * activityMultiplier);
}

export function calculateCalorieGoal(
  tdee: number,
  goal: GoalType,
  bmr = 1200,
  currentWeightKg = 0,
  goalWeightKg?: number | null,
): number {
  return calculateGoalCalorieTarget(bmr, tdee, currentWeightKg, goalWeightKg, goal);
}

export function calculateNutritionGoals(
  weight: number,
  height: number,
  age: number,
  sex: BiologicalSex,
  goal: GoalType,
  _archetype: ArchetypeKey,
  activityLevel: number = 1,
  goalWeightKg?: number | null,
  weightLogs: WeightLogInput[] = [],
): {
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
  hydrationGoalMl: number;
  bmr: number;
  tdee: number;
} {
  const targets = calculateNutritionTargets({
    weight_logs: weightLogs,
    current_weight_kg: weight,
    height_cm: height,
    age,
    sex,
    goal_type: goal,
    goal_weight_kg: goalWeightKg,
    activity_tier: mapOnboardingActivityToTier(activityLevel),
  });

  return {
    calorieGoal: targets.calorie_target,
    proteinGoal: targets.macros.protein_g,
    carbGoal: targets.macros.carbs_g,
    fatGoal: targets.macros.fat_g,
    hydrationGoalMl: targets.hydration_target_ml,
    bmr: targets.bmr,
    tdee: targets.tdee,
  };
}
