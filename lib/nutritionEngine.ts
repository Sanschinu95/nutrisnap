import type { BiologicalSex, GoalType } from '@/types/profile';

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
  /**
   * User-chosen rate of weight change in kg/week (0.25–1.0). When provided,
   * drives the deficit/surplus calculation; falls back to the weight-gap
   * heuristic otherwise. Ignored when goal_type is 'maintain'.
   */
  pace_kg_per_week?: number | null;
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

/** Energy density of one kg of body tissue, in kcal. Standard 7700 figure. */
const KCAL_PER_KG = 7700;

/** Hard caps so an aggressive pace can't push the calorie target into unsafe territory. */
const MAX_DEFICIT_FRAC_OF_TDEE = 0.2;
const MIN_SURPLUS_FRAC_OF_TDEE = 0.1;
const MAX_SURPLUS_FRAC_OF_TDEE = 0.15;

/** Allowable pace range, kg/week. Anything outside this gets clamped. */
const MIN_PACE_KG_PER_WEEK = 0.1;
const MAX_PACE_KG_PER_WEEK = 1.0;

export function calculateGoalCalorieTarget(
  bmr: number,
  tdee: number,
  currentWeightKg: number,
  goalWeightKg: number | null | undefined,
  goalType: GoalType,
  paceKgPerWeek?: number | null,
): number {
  let target = tdee;
  const weightGapKg = goalWeightKg ? goalWeightKg - currentWeightKg : 0;

  // Resolve the effective pace: explicit user choice wins, otherwise infer
  // from the size of the weight gap. Always clamped to a safe range.
  const inferredPace = inferWeeklyPaceKg(weightGapKg);
  const requestedPace =
    typeof paceKgPerWeek === 'number' && Number.isFinite(paceKgPerWeek) && paceKgPerWeek > 0
      ? paceKgPerWeek
      : inferredPace;
  const pace = clamp(requestedPace, MIN_PACE_KG_PER_WEEK, MAX_PACE_KG_PER_WEEK);

  if (goalType === 'cut' || weightGapKg < -0.25) {
    const paceDailyDeficit = (pace * KCAL_PER_KG) / 7;
    const deficit = Math.min(paceDailyDeficit, MAX_DEFICIT_FRAC_OF_TDEE * tdee);
    target = tdee - deficit;
  } else if (goalType === 'bulk' || weightGapKg > 0.25) {
    const paceDailySurplus = (pace * KCAL_PER_KG) / 7;
    const surplus = clamp(
      paceDailySurplus,
      MIN_SURPLUS_FRAC_OF_TDEE * tdee,
      MAX_SURPLUS_FRAC_OF_TDEE * tdee,
    );
    target = tdee + surplus;
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
    input.pace_kg_per_week,
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
