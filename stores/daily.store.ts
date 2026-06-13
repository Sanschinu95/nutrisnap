/**
 * Daily food and water tracking store using Zustand + Supabase
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './auth.store';
import { useUserStore } from './user.store';
import type { FoodEntry, DailySummary } from '@/types/nutrition';
import type { FoodEntryInsert } from '@/types/database';
import {
  checkAndSendProgressNotification,
  sendGoalHitNotification,
  sendStreakNotification,
} from '@/lib/notifications';

interface ProgressNotifiedFlags {
  midday?: boolean;
  almostThere?: boolean;
  nearComplete?: boolean;
  goalHit?: boolean;
}

interface DailyState {
  entries: FoodEntry[];
  summary: DailySummary | null;
  isCheatDay: boolean;
  waterMl: number;
  isLoading: boolean;
  error: string | null;
  progressNotified: ProgressNotifiedFlags;
}

interface DailyActions {
  loadToday: () => Promise<void>;
  addEntry: (entry: Omit<FoodEntryInsert, 'user_id'>) => Promise<{ success: boolean; error?: string }>;
  removeEntry: (id: string) => Promise<void>;
  toggleCheatDay: () => Promise<void>;
  addWater: (ml: number) => Promise<void>;
  clearError: () => void;
}

type DailyStore = DailyState & DailyActions;

function getTodayDate(): string {
  // Return YYYY-MM-DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to calculate summary from entries + manual water
function buildSummary(date: string, userId: string, entries: FoodEntry[], waterMl: number, isCheatDay: boolean): DailySummary {
  const calories = entries.reduce((sum, e) => sum + (e.total_calories || 0), 0);
  const protein = entries.reduce((sum, e) => sum + (e.protein_g || 0), 0);
  const carbs = entries.reduce((sum, e) => sum + (e.carbs_g || 0), 0);
  const fat = entries.reduce((sum, e) => sum + (e.fat_g || 0), 0);
  
  return {
    id: `summary-${date}`,
    user_id: userId,
    date,
    total_calories: calories,
    total_protein: protein,
    total_carbs: carbs,
    total_fat: fat,
    water_ml: waterMl,
    is_cheat_day: isCheatDay,
    goal_met: false,
  };
}

export const useDailyStore = create<DailyStore>((set, get) => ({
  entries: [],
  summary: null,
  isCheatDay: false,
  waterMl: 0,
  isLoading: false,
  error: null,
  progressNotified: {},

  loadToday: async () => {
    try {
      set({ isLoading: true, error: null });
      const user = useAuthStore.getState().user;
      if (!user) {
        set({ isLoading: false, entries: [], summary: null });
        return;
      }
      
      const today = getTodayDate();
      
      // Load entries for today
      const startOfDay = new Date();
      startOfDay.setHours(0,0,0,0);
      
      const [entriesResult, summaryResult] = await Promise.all([
        supabase
          .from('food_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('logged_at', startOfDay.toISOString())
          .order('logged_at', { ascending: false }),
        supabase
          .from('daily_summaries')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()
      ]);

      if (entriesResult.error) throw entriesResult.error;
      
      const entries = entriesResult.data as FoodEntry[] || [];
      const waterMl = summaryResult.data?.water_ml || 0;
      const isCheatDay = summaryResult.data?.is_cheat_day || false;

      const summary = buildSummary(today, user.id, entries, waterMl, isCheatDay);

      set({
        entries,
        summary,
        waterMl,
        isCheatDay,
        isLoading: false,
      });
      
    } catch (e) {
      console.error('Failed to load daily data:', e);
      set({ isLoading: false, error: 'Failed to load today data' });
    }
  },

  addEntry: async (entry) => {
    try {
      set({ isLoading: true, error: null });
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not logged in');

      const fullEntry: FoodEntryInsert = {
        ...entry,
        user_id: user.id,
      };

      // 1. Insert food entry
      const { data: insertedEntry, error: insertError } = await supabase
        .from('food_entries')
        .insert(fullEntry)
        .select()
        .single();

      if (insertError) throw insertError;

      // Update local state
      const { entries, waterMl, isCheatDay } = get();
      const newEntries = [insertedEntry as FoodEntry, ...entries];
      const today = getTodayDate();
      const newSummary = buildSummary(today, user.id, newEntries, waterMl, isCheatDay);

      // 2. Upsert daily summary
      await supabase
        .from('daily_summaries')
        .upsert({
          user_id: user.id,
          date: today,
          total_calories: newSummary.total_calories,
          total_protein: newSummary.total_protein,
          total_carbs: newSummary.total_carbs,
          total_fat: newSummary.total_fat,
          water_ml: newSummary.water_ml,
          is_cheat_day: newSummary.is_cheat_day,
        }, { onConflict: 'user_id,date' });

      set({
        entries: newEntries,
        summary: newSummary,
        isLoading: false,
      });

      // ─── Progress tracking & notifications ────────────────
      try {
        const { calorieGoal, archetype, streak } = useUserStore.getState();
        const calorieProgress = calorieGoal > 0 ? newSummary.total_calories / calorieGoal : 0;
        const { progressNotified } = get();

        // Check dynamic progress notifications
        const fired = await checkAndSendProgressNotification(
          newSummary.total_calories,
          calorieGoal,
          archetype,
          progressNotified
        );
        if (Object.keys(fired).length > 0) {
          set({ progressNotified: { ...progressNotified, ...fired } });
        }

        // Goal hit: fire notification + update archetype progress
        if (calorieProgress >= 1.0 && !progressNotified.goalHit) {
          await sendGoalHitNotification(archetype);
          set({ progressNotified: { ...get().progressNotified, goalHit: true } });
          await useUserStore.getState().updateArchetypeProgress(true);

          // Also update streak and check for milestone
          await useUserStore.getState().updateStreak();
          const newStreak = useUserStore.getState().streak;
          await sendStreakNotification(newStreak, archetype);
        }
      } catch (notifError) {
        // Don't fail the entry add if notifications fail
        console.warn('Notification check failed:', notifError);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  removeEntry: async (id: string) => {
    try {
      set({ isLoading: true });
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not logged in');

      const { error } = await supabase
        .from('food_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const { entries, waterMl, isCheatDay } = get();
      const newEntries = entries.filter((e) => e.id !== id);
      const today = getTodayDate();
      const newSummary = buildSummary(today, user.id, newEntries, waterMl, isCheatDay);

      await supabase
        .from('daily_summaries')
        .upsert({
          user_id: user.id,
          date: today,
          total_calories: newSummary.total_calories,
          total_protein: newSummary.total_protein,
          total_carbs: newSummary.total_carbs,
          total_fat: newSummary.total_fat,
          water_ml: newSummary.water_ml,
          is_cheat_day: newSummary.is_cheat_day,
        }, { onConflict: 'user_id,date' });

      set({
        entries: newEntries,
        summary: newSummary,
        isLoading: false,
      });
    } catch (error) {
      console.error('Delete entry error:', error);
      set({ isLoading: false });
    }
  },

  toggleCheatDay: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
      const { summary, isCheatDay, entries, waterMl } = get();
      const newCheatDay = !isCheatDay;

      set({ isCheatDay: newCheatDay });

      const today = getTodayDate();
      const newSummary = buildSummary(today, user.id, entries, waterMl, newCheatDay);

      await supabase
        .from('daily_summaries')
        .upsert({
          user_id: user.id,
          date: today,
          is_cheat_day: newCheatDay,
        }, { onConflict: 'user_id,date' });

      set({ summary: newSummary });
    } catch (e) {
      console.error('Toggle cheat day error:', e);
    }
  },

  addWater: async (ml: number) => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
      const { summary, waterMl, entries, isCheatDay } = get();
      const newWaterMl = waterMl + ml;

      set({ waterMl: newWaterMl });

      const today = getTodayDate();
      const newSummary = buildSummary(today, user.id, entries, newWaterMl, isCheatDay);

      await supabase
        .from('daily_summaries')
        .upsert({
          user_id: user.id,
          date: today,
          water_ml: newWaterMl,
        }, { onConflict: 'user_id,date' });

      set({ summary: newSummary });
    } catch (e) {
      console.error('Add water error:', e);
    }
  },

  clearError: () => set({ error: null }),
}));
