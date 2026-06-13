/**
 * User profile store using Zustand + Supabase
 * Loads/saves profile from Supabase, falls back to in-memory
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { calculateNutritionGoals } from '@/lib/tdee';
import type { Profile } from '@/types/database';
import type { ArchetypeKey, BiologicalSex, GoalType } from '@/types/archetype';
import type { MacroGoals } from '@/types/nutrition';
import type { ArchetypeLevel } from '@/constants/archetypeProgress';
import {
  getLevelForProgress,
  MAX_PROGRESS,
  GOAL_MET_PROGRESS,
  GOAL_MISSED_PROGRESS,
} from '@/constants/archetypeProgress';

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
  archetypeProgress: number;
  archetypeLevel: ArchetypeLevel;
  isLoading: boolean;
  isGuest: boolean;
  error: string | null;
}

interface UserActions {
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<{ success: boolean; error?: string }>;
  updateStreak: () => Promise<void>;
  updateArchetypeProgress: (goalMet: boolean) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

type UserStore = UserState & UserActions;

const DEFAULT_CALORIES = 2000;
const DEFAULT_MACROS: MacroGoals = { protein: 150, carbs: 200, fat: 67 };

function extractGoals(profile: Profile) {
  const progress = profile.archetype_progress ?? 0;
  return {
    archetype: profile.archetype ?? null,
    calorieGoal: profile.calorie_goal ?? DEFAULT_CALORIES,
    macroGoals: {
      protein: profile.protein_goal ?? DEFAULT_MACROS.protein,
      carbs: profile.carb_goal ?? DEFAULT_MACROS.carbs,
      fat: profile.fat_goal ?? DEFAULT_MACROS.fat,
    },
    streak: profile.streak_count ?? 0,
    archetypeProgress: progress,
    archetypeLevel: getLevelForProgress(progress).key,
  };
}

export const useUserStore = create<UserStore>((set, get) => ({
  profile: null,
  archetype: null,
  calorieGoal: DEFAULT_CALORIES,
  macroGoals: DEFAULT_MACROS,
  streak: 0,
  archetypeProgress: 0,
  archetypeLevel: 'pup' as ArchetypeLevel,
  isLoading: false,
  isGuest: false,
  error: null,

  loadProfile: async () => {
    try {
      set({ isLoading: true });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ isLoading: false, profile: null });
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        // No profile yet (new user)
        set({ isLoading: false, profile: null });
        return;
      }

      const profile = data as Profile;
      set({
        profile,
        ...extractGoals(profile),
        isLoading: false,
      });
    } catch (error) {
      console.error('Load profile error:', error);
      set({ isLoading: false });
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const { profile } = get();
    if (!profile) return;

    try {
      // Optimistic in-memory update
      const updated = { ...profile, ...updates, updated_at: new Date().toISOString() };
      set({
        profile: updated,
        ...extractGoals(updated),
      });

      // Persist to Supabase
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        console.warn('Profile update failed:', error.message);
      }
    } catch (error) {
      console.warn('Profile update error:', error);
    }
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

      // Check if user is authenticated
      let userId: string;
      let isGuest = false;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
        } else {
          // Guest mode — save locally only
          userId = `guest_${Date.now()}`;
          isGuest = true;
        }
      } catch {
        // Auth check failed — proceed as guest
        userId = `guest_${Date.now()}`;
        isGuest = true;
      }

      const profileData = {
        id: userId,
        name: data.name,
        age: data.age,
        biological_sex: data.biological_sex,
        height_cm: data.height_cm,
        weight_kg: data.weight_kg,
        goal_weight_kg: data.goal_weight_kg ?? null,
        goal_type: data.goal_type,
        archetype: data.archetype,
        archetype_tier: 'base' as const,
        archetype_progress: 0,
        archetype_level: 'pup',
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

      // Only persist to Supabase if authenticated
      if (!isGuest) {
        const { error } = await supabase
          .from('profiles')
          .upsert(profileData, { onConflict: 'id' });

        if (error) {
          console.warn('Supabase upsert error:', error.message);
          // Fall through -- save locally even if Supabase fails
        }
      }

      const profile = profileData as Profile;
      set({
        profile,
        ...extractGoals(profile),
        isLoading: false,
        isGuest,
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

    const updates = {
      streak_count: newStreak,
      longest_streak: longestStreak,
      last_logged_date: today,
    };

    set({
      streak: newStreak,
      profile: { ...profile, ...updates },
    });

    // Persist to Supabase
    try {
      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);
    } catch (error) {
      console.warn('Streak update failed:', error);
    }
  },

  updateArchetypeProgress: async (goalMet: boolean) => {
    const { profile } = get();
    if (!profile) return;

    const increment = goalMet ? GOAL_MET_PROGRESS : GOAL_MISSED_PROGRESS;
    const newProgress = Math.min(
      (profile.archetype_progress ?? 0) + increment,
      MAX_PROGRESS
    );
    const newLevel = getLevelForProgress(newProgress);

    const updates = {
      archetype_progress: newProgress,
      archetype_level: newLevel.key,
    };

    set({
      archetypeProgress: newProgress,
      archetypeLevel: newLevel.key,
      profile: { ...profile, ...updates },
    });

    try {
      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);
    } catch (error) {
      console.warn('Archetype progress update failed:', error);
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    profile: null,
    archetype: null,
    calorieGoal: DEFAULT_CALORIES,
    macroGoals: DEFAULT_MACROS,
    streak: 0,
    archetypeProgress: 0,
    archetypeLevel: 'pup' as ArchetypeLevel,
    isLoading: false,
    isGuest: false,
    error: null,
  }),
}));
