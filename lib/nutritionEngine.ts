import type { BiologicalSex, GoalType } from '@/types/archetype';

export type UnitPreference = 'metric' | 'imperial';
export type ActivityTier = 'low' | 'moderate' | 'high';

export interface WeightLogInput {
  weight_kg: number;
  logged_at?: string;
}

export interface NutritionEngineInput {
  age: number;
  sex: BiologicalSex;
  height_cm: number;
  current_weight_kg: number;
  goal_weight_kg?: number | null;
  goal_type: GoalType;
  activity_tier: ActivityTier;
  weight_logs?: WeightLogInput[];
}

export interface MacroTargets {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionTargets {
  smoothed_weight_kg: number;
  bmr: number;
  tdee: number;
  calorie_target: number;
  macros: MacroTargets;
  hydration_target_ml: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityTier, number> = {
  low: 1.2,
  moderate: 1.55,
  high: 1.725,
};

const HYDRATION_ML_PER_KG: Record<ActivityTier, number> = {
  low: 30,
  moderate: 33,
  high: 35,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mapOnboardingActivityToTier(level: number | ActivityTier): ActivityTier {
  if (level === 'low' || level === 'moderate' || level === 'high') return level;
  if (level <= 1) return 'low';
  if (level === 2) return 'moderate';
  return 'high';
}

export function calculateSmoothedWeightKg(
  currentWeightKg: number,
  weightLogs: WeightLogInput[] = [],
): number {
  const latestWeights = [...weightLogs]
    .filter((log) => Number.isFinite(log.weight_kg) && log.weight_kg > 0)
    .sort((a, b) => {
      const left = a.logged_at ? new Date(a.logged_at).getTime() : 0;
      const right = b.logged_at ? new Date(b.logged_at).getTime() : 0;
      return right - left;
    })
    .slice(0, 7)
    .map((log) => log.weight_kg);

  if (latestWeights.length === 0) return currentWeightKg;
  return latestWeights.reduce((sum, weight) => sum + weight, 0) / latestWeights.length;
}

export function calculateBmrMifflinStJeor(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: BiologicalSex,
): number {
  const sexOffset = sex === 'male' ? 5 : -161;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
}

export function calculateTdeeFromBmr(bmr: number, activityTier: ActivityTier): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityTier];
}

export function inferWeeklyPaceKg(weightGapKg: number): number {
  const gap = Math.abs(weightGapKg);
  if (gap < 3) return 0.25;
  if (gap < 8) return 0.5;
  return 0.75;
}

export function calculateGoalCalorieTarget(
  bmr: number,
  tdee: number,
  currentWeightKg: number,
  goalWeightKg: number | null | undefined,
  goalType: GoalType,
): number {
  let target = tdee;
  const weightGapKg = goalWeightKg ? goalWeightKg - currentWeightKg : 0;

  if (goalType === 'cut' || weightGapKg < -0.25) {
    const deficit = Math.min((inferWeeklyPaceKg(weightGapKg) * 7700) / 7, 0.2 * tdee);
    target = tdee - deficit;
  } else if (goalType === 'bulk' || weightGapKg > 0.25) {
    const gapBasedSurplus = inferWeeklyPaceKg(weightGapKg) <= 0.25 ? 0.1 * tdee : 0.15 * tdee;
    target = tdee + clamp(gapBasedSurplus, 0.1 * tdee, 0.15 * tdee);
  }

  return Math.round(Math.max(target, bmr, 1200));
}

export function calculateMacroTargets(
  calorieTarget: number,
  weightKg: number,
  goalType: GoalType,
): MacroTargets {
  const proteinPerKg = goalType === 'maintain' ? 1.4 : 1.9;
  const fatPerKg = goalType === 'cut' ? 0.6 : goalType === 'bulk' ? 0.8 : 0.7;
  const protein_g = Math.round(weightKg * proteinPerKg);
  const fat_g = Math.round(weightKg * fatPerKg);
  const remainingCalories = Math.max(0, calorieTarget - protein_g * 4 - fat_g * 9);
  const carbs_g = Math.round(remainingCalories / 4);

  return { protein_g, carbs_g, fat_g };
}

export function calculateHydrationTargetMl(weightKg: number, activityTier: ActivityTier): number {
  return Math.round((weightKg * HYDRATION_ML_PER_KG[activityTier]) / 50) * 50;
}

export function calculateNutritionTargets(input: NutritionEngineInput): NutritionTargets {
  const activityTier = input.activity_tier;
  const smoothedWeightKg = calculateSmoothedWeightKg(input.current_weight_kg, input.weight_logs);
  const bmr = calculateBmrMifflinStJeor(smoothedWeightKg, input.height_cm, input.age, input.sex);
  const tdee = calculateTdeeFromBmr(bmr, activityTier);
  const calorieTarget = calculateGoalCalorieTarget(
    bmr,
    tdee,
    smoothedWeightKg,
    input.goal_weight_kg,
    input.goal_type,
  );

  return {
    smoothed_weight_kg: Math.round(smoothedWeightKg * 10) / 10,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorie_target: calorieTarget,
    macros: calculateMacroTargets(calorieTarget, smoothedWeightKg, input.goal_type),
    hydration_target_ml: calculateHydrationTargetMl(smoothedWeightKg, activityTier),
  };
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462);
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 10) / 10;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}
