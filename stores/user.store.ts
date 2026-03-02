/**
 * User profile store using Zustand
 * MOCK version — no Supabase, uses in-memory data for local testing
 */

import { create } from 'zustand';
import { calculateNutritionGoals } from '@/lib/tdee';
import type { Profile } from '@/types/database';
import type { ArchetypeKey, BiologicalSex, GoalType } from '@/types/archetype';
import type { MacroGoals } from '@/types/nutrition';

interface OnboardingData {
  name: string;
  age: number;
  biological_sex: BiologicalSex;
  height_cm: number;
  weight_kg: number;
  goal_weight_kg?: number;
  goal_type: GoalType;
  activity_level: number;
  archetype: ArchetypeKey;
}

interface UserState {
  profile: Profile | null;
  archetype: ArchetypeKey | null;
  calorieGoal: number;
  macroGoals: MacroGoals;
  streak: number;
  isLoading: boolean;
  error: string | null;
}

interface UserActions {
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<{ success: boolean; error?: string }>;
  updateStreak: () => Promise<void>;
  clearError: () => void;
}

type UserStore = UserState & UserActions;

// ── Pre-baked mock profile so the UI has data on first launch ──
const MOCK_PROFILE: Profile = {
  id: 'local-mock-user-0001',
  name: 'NutriSnap Tester',
  age: 24,
  weight_kg: 75,
  height_cm: 175,
  goal_weight_kg: 70,
  goal_type: 'cut',
  biological_sex: 'male',
  calorie_goal: 2100,
  protein_goal: 160,
  carb_goal: 220,
  fat_goal: 65,
  archetype: 'wolf',
  archetype_tier: 'base',
  streak_count: 3,
  longest_streak: 7,
  last_logged_date: new Date().toISOString().split('T')[0],
  onboarding_complete: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const useUserStore = create<UserStore>((set, get) => ({
  // State — start with the mock profile already loaded
  profile: MOCK_PROFILE,
  archetype: MOCK_PROFILE.archetype,
  calorieGoal: MOCK_PROFILE.calorie_goal ?? 2000,
  macroGoals: {
    protein: MOCK_PROFILE.protein_goal ?? 150,
    carbs: MOCK_PROFILE.carb_goal ?? 200,
    fat: MOCK_PROFILE.fat_goal ?? 67,
  },
  streak: MOCK_PROFILE.streak_count,
  isLoading: false,
  error: null,

  // Actions — all in-memory, no network calls

  loadProfile: async () => {
    // Already loaded — just make sure flag is correct
    const { profile } = get();
    if (!profile) {
      set({ profile: MOCK_PROFILE, archetype: MOCK_PROFILE.archetype, isLoading: false });
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const { profile } = get();
    if (!profile) return;
    const updated = { ...profile, ...updates, updated_at: new Date().toISOString() };
    set({
      profile: updated,
      archetype: updated.archetype ?? get().archetype,
      calorieGoal: updated.calorie_goal ?? get().calorieGoal,
      macroGoals: {
        protein: updated.protein_goal ?? get().macroGoals.protein,
        carbs: updated.carb_goal ?? get().macroGoals.carbs,
        fat: updated.fat_goal ?? get().macroGoals.fat,
      },
      streak: updated.streak_count ?? 0,
    });
  },

  completeOnboarding: async (data: OnboardingData) => {
    try {
      set({ isLoading: true, error: null });

      const goals = calculateNutritionGoals(
        data.weight_kg,
        data.height_cm,
        data.age,
        data.biological_sex,
        data.goal_type,
        data.archetype,
        data.activity_level,
      );

      const newProfile: Profile = {
        id: 'local-mock-user-0001',
        name: data.name,
        age: data.age,
        biological_sex: data.biological_sex,
        height_cm: data.height_cm,
        weight_kg: data.weight_kg,
        goal_weight_kg: data.goal_weight_kg ?? null,
        goal_type: data.goal_type,
        archetype: data.archetype,
        archetype_tier: 'base',
        calorie_goal: goals.calorieGoal,
        protein_goal: goals.proteinGoal,
        carb_goal: goals.carbGoal,
        fat_goal: goals.fatGoal,
        streak_count: 0,
        longest_streak: 0,
        last_logged_date: null,
        onboarding_complete: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set({
        profile: newProfile,
        archetype: data.archetype,
        calorieGoal: goals.calorieGoal,
        macroGoals: { protein: goals.proteinGoal, carbs: goals.carbGoal, fat: goals.fatGoal },
        streak: 0,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      console.error('Complete onboarding error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  updateStreak: async () => {
    const { profile } = get();
    if (!profile) return;

    const today = new Date().toISOString().split('T')[0];
    const lastLogged = profile.last_logged_date;
    let newStreak = profile.streak_count;

    if (lastLogged === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    newStreak = lastLogged === yesterdayStr ? newStreak + 1 : 1;
    const longestStreak = Math.max(newStreak, profile.longest_streak);

    set({
      streak: newStreak,
      profile: {
        ...profile,
        streak_count: newStreak,
        longest_streak: longestStreak,
        last_logged_date: today,
      },
    });
  },

  clearError: () => set({ error: null }),
}));
