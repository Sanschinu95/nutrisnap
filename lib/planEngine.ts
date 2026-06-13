/**
 * Rule-Based Plan Engine
 * Pure TypeScript - no API calls, fully deterministic and testable
 * Takes user profile -> returns a complete PersonalizedPlan
 */

import { ARCHETYPE_MACROS, type ArchetypeKey } from '@/constants/archetypes';
import { FOOD_DATABASE, type FoodData } from './foodDatabase';
import type { GoalType } from '@/types/archetype';

// ─── Types ───────────────────────────────────────────────────

export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';

export interface PlanEngineInput {
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: 'male' | 'female';
  goal_type: GoalType;
  activity_level: ActivityLevel;
  archetype: ArchetypeKey;
}

export interface FoodSuggestion {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealSlot {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  items: FoodSuggestion[];
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
}

export interface WorkoutDay {
  day: string;
  type: 'Strength' | 'Cardio' | 'Yoga' | 'Rest' | 'Active Recovery' | 'Push' | 'Pull' | 'Legs' | 'Full Body';
  exercises: Exercise[];
}

export interface PersonalizedPlan {
  daily_calories: number;
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  meal_plan: {
    breakfast: MealSlot;
    lunch: MealSlot;
    snack: MealSlot;
    dinner: MealSlot;
  };
  workout_plan: WorkoutDay[];
}

// ─── Constants ───────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55,
  very_active: 1.725,
};

const GOAL_ADJUSTMENTS: Record<GoalType, number> = {
  cut: -400,
  maintain: 0,
  bulk: 300,
};

// Meal calorie distribution
const MEAL_DISTRIBUTION = {
  breakfast: 0.25,
  lunch: 0.35,
  snack: 0.10,
  dinner: 0.30,
} as const;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Exercise Templates ──────────────────────────────────────

const PUSH_EXERCISES: Exercise[] = [
  { name: 'Bench Press', sets: 4, reps: '8-10' },
  { name: 'Overhead Press', sets: 3, reps: '8-10' },
  { name: 'Incline DB Press', sets: 3, reps: '10-12' },
  { name: 'Tricep Dips', sets: 3, reps: '10-12' },
  { name: 'Lateral Raises', sets: 3, reps: '12-15' },
  { name: 'Push-ups', sets: 3, reps: '15-20' },
];

const PULL_EXERCISES: Exercise[] = [
  { name: 'Deadlift', sets: 4, reps: '5-6' },
  { name: 'Bent-over Row', sets: 4, reps: '8-10' },
  { name: 'Pull-ups', sets: 3, reps: '6-10' },
  { name: 'Face Pulls', sets: 3, reps: '12-15' },
  { name: 'Bicep Curls', sets: 3, reps: '10-12' },
  { name: 'Cable Row', sets: 3, reps: '10-12' },
];

const LEG_EXERCISES: Exercise[] = [
  { name: 'Squats', sets: 4, reps: '8-10' },
  { name: 'Romanian Deadlift', sets: 3, reps: '10-12' },
  { name: 'Leg Press', sets: 3, reps: '10-12' },
  { name: 'Lunges', sets: 3, reps: '12 each' },
  { name: 'Calf Raises', sets: 4, reps: '15-20' },
  { name: 'Leg Curl', sets: 3, reps: '10-12' },
];

const FULL_BODY_EXERCISES: Exercise[] = [
  { name: 'Squats', sets: 3, reps: '10-12' },
  { name: 'Push-ups', sets: 3, reps: '12-15' },
  { name: 'DB Row', sets: 3, reps: '10-12' },
  { name: 'Overhead Press', sets: 3, reps: '10-12' },
  { name: 'Plank', sets: 3, reps: '45 sec' },
  { name: 'Romanian Deadlift', sets: 3, reps: '10-12' },
];

const CARDIO_ROUTINES: Exercise[][] = [
  [{ name: 'Running', sets: 1, reps: '30 min' }],
  [{ name: 'Cycling', sets: 1, reps: '30 min' }],
  [{ name: 'Jump Rope', sets: 1, reps: '20 min' }],
  [{ name: 'Brisk Walk', sets: 1, reps: '45 min' }],
];

const YOGA_EXERCISES: Exercise[] = [
  { name: 'Sun Salutation', sets: 5, reps: 'flow' },
  { name: 'Warrior I', sets: 1, reps: '30 sec each' },
  { name: 'Warrior II', sets: 1, reps: '30 sec each' },
  { name: 'Downward Dog', sets: 1, reps: '60 sec' },
  { name: "Child's Pose", sets: 1, reps: '60 sec' },
  { name: 'Pigeon Pose', sets: 1, reps: '30 sec each' },
];

// ─── TDEE Calculation ────────────────────────────────────────

function calculateBMR(weight: number, height: number, age: number, sex: 'male' | 'female'): number {
  if (sex === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

// ─── Meal Builder ────────────────────────────────────────────

function buildMealSlot(
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner',
  targetCalories: number,
  targetProtein: number,
  targetCarbs: number,
  targetFat: number,
): MealSlot {
  // Filter foods that can appear in this meal
  const candidates = FOOD_DATABASE.filter((f) => f.mealTypes.includes(mealType));

  if (candidates.length === 0) {
    return {
      name: mealType.charAt(0).toUpperCase() + mealType.slice(1),
      calories: targetCalories,
      protein_g: targetProtein,
      carbs_g: targetCarbs,
      fat_g: targetFat,
      items: [],
    };
  }

  // Sort by protein density for protein-heavy diets
  const sorted = [...candidates].sort((a, b) => b.protein_g - a.protein_g);

  const items: FoodSuggestion[] = [];
  let remainingCal = targetCalories;
  let remainingProtein = targetProtein;
  const usedNames = new Set<string>();
  const maxItems = mealType === 'snack' ? 2 : 3;

  for (const food of sorted) {
    if (items.length >= maxItems) break;
    if (remainingCal <= 30) break;
    if (usedNames.has(food.name)) continue;

    // Calculate portion to fit remaining calories
    const portionRatio = Math.min(
      remainingCal / food.calories,
      2.5, // Max 250g portion
    );
    const quantity_g = Math.round(Math.max(50, portionRatio * 100));
    const scale = quantity_g / 100;

    const itemCals = Math.round(food.calories * scale);
    if (itemCals < 20) continue;

    items.push({
      name: food.name,
      quantity_g,
      calories: itemCals,
      protein_g: Math.round(food.protein_g * scale * 10) / 10,
      carbs_g: Math.round(food.carbs_g * scale * 10) / 10,
      fat_g: Math.round(food.fat_g * scale * 10) / 10,
    });

    remainingCal -= itemCals;
    remainingProtein -= food.protein_g * scale;
    usedNames.add(food.name);
  }

  const totalCal = items.reduce((s, i) => s + i.calories, 0);
  const totalP = items.reduce((s, i) => s + i.protein_g, 0);
  const totalC = items.reduce((s, i) => s + i.carbs_g, 0);
  const totalF = items.reduce((s, i) => s + i.fat_g, 0);

  const labels: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    snack: 'Evening Snack',
    dinner: 'Dinner',
  };

  return {
    name: labels[mealType] ?? mealType,
    calories: Math.round(totalCal),
    protein_g: Math.round(totalP),
    carbs_g: Math.round(totalC),
    fat_g: Math.round(totalF),
    items,
  };
}

// ─── Workout Builder ─────────────────────────────────────────

const PPL_ARCHETYPES: ArchetypeKey[] = ['wolf', 'bear', 'lion', 'tigress', 'swan'];
const GENTLE_ARCHETYPES: ArchetypeKey[] = ['deer', 'doe', 'phoenix'];

function buildWorkoutPlan(goalType: GoalType, archetype: ArchetypeKey): WorkoutDay[] {
  if (goalType === 'cut') {
    // Cut: Full body + cardio alternating
    return [
      { day: DAYS[0], type: 'Full Body', exercises: FULL_BODY_EXERCISES },
      { day: DAYS[1], type: 'Cardio', exercises: CARDIO_ROUTINES[0] },
      { day: DAYS[2], type: 'Full Body', exercises: FULL_BODY_EXERCISES },
      { day: DAYS[3], type: 'Cardio', exercises: CARDIO_ROUTINES[1] },
      { day: DAYS[4], type: 'Full Body', exercises: FULL_BODY_EXERCISES },
      { day: DAYS[5], type: 'Cardio', exercises: CARDIO_ROUTINES[2] },
      { day: DAYS[6], type: 'Rest', exercises: [] },
    ];
  }

  if (goalType === 'bulk') {
    if (PPL_ARCHETYPES.includes(archetype)) {
      return [
        { day: DAYS[0], type: 'Push', exercises: PUSH_EXERCISES },
        { day: DAYS[1], type: 'Pull', exercises: PULL_EXERCISES },
        { day: DAYS[2], type: 'Legs', exercises: LEG_EXERCISES },
        { day: DAYS[3], type: 'Push', exercises: PUSH_EXERCISES },
        { day: DAYS[4], type: 'Pull', exercises: PULL_EXERCISES },
        { day: DAYS[5], type: 'Legs', exercises: LEG_EXERCISES },
        { day: DAYS[6], type: 'Rest', exercises: [] },
      ];
    }
    // Gentle archetypes
    return [
      { day: DAYS[0], type: 'Strength', exercises: FULL_BODY_EXERCISES },
      { day: DAYS[1], type: 'Yoga', exercises: YOGA_EXERCISES },
      { day: DAYS[2], type: 'Strength', exercises: FULL_BODY_EXERCISES },
      { day: DAYS[3], type: 'Yoga', exercises: YOGA_EXERCISES },
      { day: DAYS[4], type: 'Strength', exercises: FULL_BODY_EXERCISES },
      { day: DAYS[5], type: 'Active Recovery', exercises: CARDIO_ROUTINES[3] },
      { day: DAYS[6], type: 'Rest', exercises: [] },
    ];
  }

  // Maintain
  return [
    { day: DAYS[0], type: 'Full Body', exercises: FULL_BODY_EXERCISES },
    { day: DAYS[1], type: 'Cardio', exercises: CARDIO_ROUTINES[0] },
    { day: DAYS[2], type: 'Full Body', exercises: FULL_BODY_EXERCISES },
    { day: DAYS[3], type: 'Rest', exercises: [] },
    { day: DAYS[4], type: 'Full Body', exercises: FULL_BODY_EXERCISES },
    { day: DAYS[5], type: 'Cardio', exercises: CARDIO_ROUTINES[1] },
    { day: DAYS[6], type: 'Rest', exercises: [] },
  ];
}

// ─── Main Engine ─────────────────────────────────────────────

export function generatePlan(input: PlanEngineInput): PersonalizedPlan {
  // 1. Calculate TDEE
  const bmr = calculateBMR(input.weight_kg, input.height_cm, input.age, input.sex);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activity_level]);
  const dailyCalories = Math.max(1200, tdee + GOAL_ADJUSTMENTS[input.goal_type]);

  // 2. Calculate macros from archetype splits
  const macroSplit = ARCHETYPE_MACROS[input.archetype];
  const protein_g = Math.round((dailyCalories * macroSplit.protein) / 4);
  const carbs_g = Math.round((dailyCalories * macroSplit.carbs) / 4);
  const fat_g = Math.round((dailyCalories * macroSplit.fat) / 9);

  // 3. Build meal plan
  const mealTypes = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
  const meals: Record<string, MealSlot> = {};

  for (const meal of mealTypes) {
    const ratio = MEAL_DISTRIBUTION[meal];
    meals[meal] = buildMealSlot(
      meal,
      Math.round(dailyCalories * ratio),
      Math.round(protein_g * ratio),
      Math.round(carbs_g * ratio),
      Math.round(fat_g * ratio),
    );
  }

  // 4. Build workout plan
  const workout_plan = buildWorkoutPlan(input.goal_type, input.archetype);

  return {
    daily_calories: dailyCalories,
    macros: { protein_g, carbs_g, fat_g },
    meal_plan: {
      breakfast: meals.breakfast,
      lunch: meals.lunch,
      snack: meals.snack,
      dinner: meals.dinner,
    },
    workout_plan,
  };
}
