/**
 * Core profile enums shared across onboarding, nutrition, and the profile store.
 * (Replaces the former types/archetype.ts — the animal-archetype system was removed.)
 */

export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';

export type GoalType = 'cut' | 'maintain' | 'bulk';

/**
 * Dietary style chosen during onboarding (the "eating style" question).
 * A presentation-only personalization hint — it does NOT affect calorie or
 * macro targets, which are derived purely from body metrics + goal.
 */
export type DietStyle = 'balanced' | 'high_protein' | 'plant_forward' | 'strength';

export const DIET_STYLES: DietStyle[] = [
  'balanced',
  'high_protein',
  'plant_forward',
  'strength',
];
