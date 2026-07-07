/**
 * User profile store using Zustand + Supabase
 * Loads/saves profile from Supabase, falls back to in-memory
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { calculateNutritionGoals } from '@/lib/tdee';
import { calculateNutritionTargets, mapOnboardingActivityToTier, type WeightLogInput } from '@/lib/nutritionEngine';
import type { DietaryPreferences, Profile } from '@/types/database';
import type { BiologicalSex, GoalType, DietStyle } from '@/types/profile';
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
  unit_preference?: 'metric' | 'imperial';
  diet_style: DietStyle;
  dietary_preferences?: DietaryPreferences;
  pace_kg_per_week?: number | null;
  medical_conditions?: string[];
}

interface UserState {
  profile: Profile | null;
  dietStyle: DietStyle | null;
  friendCode: string | null;
  isGhostMode: boolean;
  calorieGoal: number;
  macroGoals: MacroGoals;
  hydrationGoalMl: number;
  streak: number;
  isLoading: boolean;
  isGuest: boolean;
  error: string | null;
}

interface UserActions {
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<{ success: boolean; error?: string }>;
  updateStreak: () => Promise<void>;
  markScanTutorialSeen: (userId: string) => Promise<void>;
  resetScanTutorial: (userId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

type UserStore = UserState & UserActions;

const DEFAULT_CALORIES = 2000;
const DEFAULT_MACROS: MacroGoals = { protein: 150, carbs: 200, fat: 67 };
const DEFAULT_HYDRATION_ML = 2500;

function extractGoals(profile: Profile) {
  return {
    dietStyle: profile.diet_style ?? null,
    friendCode: profile.friend_code ?? null,
    isGhostMode: profile.is_ghost_mode ?? false,
    calorieGoal: profile.calorie_goal ?? DEFAULT_CALORIES,
    macroGoals: {
      protein: profile.protein_goal ?? DEFAULT_MACROS.protein,
      carbs: profile.carb_goal ?? DEFAULT_MACROS.carbs,
      fat: profile.fat_goal ?? DEFAULT_MACROS.fat,
    },
    hydrationGoalMl: profile.hydration_goal_ml ?? DEFAULT_HYDRATION_ML,
    streak: profile.streak_count ?? 0,
  };
}

async function loadRecentWeights(userId: string): Promise<WeightLogInput[]> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('weight_kg, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(7);

  if (error) return [];
  return (data ?? []).map((log) => ({
    weight_kg: Number(log.weight_kg),
    logged_at: log.logged_at,
  }));
}

async function buildRecomputedGoalUpdates(profile: Profile): Promise<Partial<Profile>> {
  if (!profile.weight_kg || !profile.height_cm || !profile.age || !profile.biological_sex || !profile.goal_type) {
    return {};
  }

  const targets = calculateNutritionTargets({
    age: profile.age,
    sex: profile.biological_sex,
    height_cm: profile.height_cm,
    current_weight_kg: profile.weight_kg,
    goal_weight_kg: profile.goal_weight_kg,
    goal_type: profile.goal_type,
    activity_tier: profile.activity_tier ?? 'low',
    weight_logs: await loadRecentWeights(profile.id),
    pace_kg_per_week: profile.pace_kg_per_week,
  });

  return {
    calorie_goal: targets.calorie_target,
    protein_goal: targets.macros.protein_g,
    carb_goal: targets.macros.carbs_g,
    fat_goal: targets.macros.fat_g,
    hydration_goal_ml: targets.hydration_target_ml,
  };
}

export const useUserStore = create<UserStore>((set, get) => ({
  profile: null,
  dietStyle: null,
  friendCode: null,
  isGhostMode: false,
  calorieGoal: DEFAULT_CALORIES,
  macroGoals: DEFAULT_MACROS,
  hydrationGoalMl: DEFAULT_HYDRATION_ML,
  streak: 0,
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

      if (data && !error) {
        const profile = data as Profile;
        set({
          profile,
          ...extractGoals(profile),
          isLoading: false,
          isGuest: false,
        });
        return;
      }

      // No Supabase profile row for this authenticated user yet. Before
      // clearing local state (which would force re-onboarding), check whether
      // the current local state is a completed guest profile — if so, port it
      // to this new user id so their answers survive the sign-in.
      const existing = get().profile;
      const isCompletedGuest =
        existing?.onboarding_complete === true &&
        typeof existing?.id === 'string' &&
        existing.id.startsWith('guest_');

      if (isCompletedGuest && existing) {
        const migratedProfile: Profile = {
          ...existing,
          id: user.id,
          updated_at: new Date().toISOString(),
        };
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(migratedProfile, { onConflict: 'id' });
        if (upsertError) {
          console.warn('Guest → auth profile migration failed:', upsertError.message);
        }
        set({
          profile: migratedProfile,
          ...extractGoals(migratedProfile),
          isLoading: false,
          isGuest: false,
        });
        return;
      }

      // Truly new user — no local answers to preserve.
      set({ isLoading: false, profile: null, isGuest: false });
    } catch (error) {
      console.error('Load profile error:', error);
      set({ isLoading: false });
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const { profile } = get();
    if (!profile) return;

    try {
      const shouldRecompute = [
        'weight_kg',
        'height_cm',
        'age',
        'biological_sex',
        'goal_type',
        'goal_weight_kg',
        'activity_tier',
        'pace_kg_per_week',
      ].some((field) => field in updates);
      const baseProfile = { ...profile, ...updates };
      const recomputed = shouldRecompute ? await buildRecomputedGoalUpdates(baseProfile) : {};
      const finalUpdates = { ...updates, ...recomputed };

      // Optimistic in-memory update
      const updated = { ...profile, ...finalUpdates, updated_at: new Date().toISOString() };
      set({
        profile: updated,
        ...extractGoals(updated),
      });

      // Persist to Supabase
      const { error } = await supabase
        .from('profiles')
        .update(finalUpdates)
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
        data.activity_level,
        data.goal_weight_kg,
        [],
        data.pace_kg_per_week,
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
        unit_preference: data.unit_preference ?? 'metric',
        activity_tier: mapOnboardingActivityToTier(data.activity_level),
        diet_style: data.diet_style,
        dietary_preferences: data.dietary_preferences ?? null,
        pace_kg_per_week: data.pace_kg_per_week ?? null,
        medical_conditions: data.medical_conditions ?? [],
        calorie_goal: goals.calorieGoal,
        protein_goal: goals.proteinGoal,
        carb_goal: goals.carbGoal,
        fat_goal: goals.fatGoal,
        hydration_goal_ml: goals.hydrationGoalMl,
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

    // Delegate to the v2 streak store which owns milestones + grace logic and
    // writes back into profile.streak_count for legacy displays. Inline-require
    // dodges the cycle (streak.store imports user.store for setState).
    try {
      const mod = await import('./streak.store');
      await mod.useStreakStore.getState().recordMealLogged(profile.id);
    } catch (error) {
      console.warn('Streak update failed:', error);
    }
  },

  markScanTutorialSeen: async (userId: string) => {
    const { profile } = get();
    if (profile) {
      set({ profile: { ...profile, has_seen_scan_tutorial: true } });
    }
    // Skip the DB write for guests / unauthenticated sessions.
    if (!userId || userId.startsWith('guest_')) return;
    const { error } = await supabase
      .from('profiles')
      .update({ has_seen_scan_tutorial: true })
      .eq('id', userId);
    if (error) console.warn('markScanTutorialSeen failed:', error.message);
  },

  resetScanTutorial: async (userId: string) => {
    const { profile } = get();
    if (profile) {
      set({ profile: { ...profile, has_seen_scan_tutorial: false } });
    }
    clearScanTutorialSessionFlag();
    if (!userId || userId.startsWith('guest_')) return;
    const { error } = await supabase
      .from('profiles')
      .update({ has_seen_scan_tutorial: false })
      .eq('id', userId);
    if (error) console.warn('resetScanTutorial failed:', error.message);
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    profile: null,
    dietStyle: null,
    friendCode: null,
    isGhostMode: false,
    calorieGoal: DEFAULT_CALORIES,
    macroGoals: DEFAULT_MACROS,
    hydrationGoalMl: DEFAULT_HYDRATION_ML,
    streak: 0,
    isLoading: false,
    isGuest: false,
    error: null,
  }),
}));

/* ─── Scan-tutorial session flag ───────────────────────────────
 *
 * A module-level flag the Scan-tab focus guard reads first. It survives
 * across camera <-> tutorial transitions in the same JS instance without
 * depending on Zustand rehydration or Supabase round-trips. Reset when
 * the user pulls "Show scan tips again" from Settings.
 */

let scanTutorialSeenInSession = false;

export function setScanTutorialSeenInSession(): void {
  scanTutorialSeenInSession = true;
}

export function hasSeenScanTutorialInSession(): boolean {
  return scanTutorialSeenInSession;
}

function clearScanTutorialSessionFlag(): void {
  scanTutorialSeenInSession = false;
}

