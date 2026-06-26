/**
 * Daily food and water tracking store using Zustand + Supabase
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './auth.store';
import { useUserStore } from './user.store';
import type { FoodEntry, DailySummary } from '@/types/nutrition';
import type { FoodEntryInsert, FoodItemRow, MealRow } from '@/types/database';
import {
  checkAndSendProgressNotification,
  sendGoalHitNotification,
  sendStreakNotification,
} from '@/lib/notifications';
import { trackEvent } from '@/lib/telemetry';

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

function getStartOfToday(): Date {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
}

function toLocalTimestamp(date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

function mealToFoodEntry(meal: MealRow & { food_items?: FoodItemRow[] }): FoodEntry {
  const foodItems = meal.food_items ?? [];
  return {
    id: meal.id,
    user_id: meal.user_id,
    occurred_at_local: meal.occurred_at_local,
    occurred_at_utc: meal.occurred_at_utc,
    source: meal.source,
    meal_name: foodItems[0]?.name ?? 'Meal',
    food_items: foodItems.map((item) => ({
      id: item.id,
      meal_id: item.meal_id,
      name: item.name,
      quantity: item.grams ? `${item.grams}g` : item.portion_size_tier ?? '1 serving',
      calories: item.calories,
      protein_g: item.protein,
      carbs_g: item.carbs,
      fat_g: item.fat,
      fiber_g: 0,
      confidence: 'medium',
      portion_size_tier: item.portion_size_tier,
      grams: item.grams,
    })),
    total_calories: meal.total_calories,
    protein_g: meal.total_protein,
    carbs_g: meal.total_carbs,
    fat_g: meal.total_fat,
    fiber_g: null,
    image_url: meal.image_url,
    raw_ai_response: null,
    user_corrections: null,
    user_accepted_without_edit: true,
    is_cheat_day: false,
    logged_at: meal.occurred_at_utc,
  };
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
      
      const startOfDay = getStartOfToday();
      
      const [mealsResult, hydrationResult, summaryResult] = await Promise.all([
        supabase
          .from('meals')
          .select('*, food_items(*)')
          .eq('user_id', user.id)
          .gte('occurred_at_utc', startOfDay.toISOString())
          .order('occurred_at_utc', { ascending: false }),
        supabase
          .from('hydration_logs')
          .select('amount_ml')
          .eq('user_id', user.id)
          .gte('occurred_at_utc', startOfDay.toISOString()),
        supabase
          .from('daily_summaries')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()
      ]);

      let entries: FoodEntry[] = [];
      if (!mealsResult.error) {
        entries = ((mealsResult.data ?? []) as (MealRow & { food_items?: FoodItemRow[] })[]).map(mealToFoodEntry);
      } else {
        const entriesResult = await supabase
          .from('food_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('logged_at', startOfDay.toISOString())
          .order('logged_at', { ascending: false });
        if (entriesResult.error) throw entriesResult.error;
        entries = entriesResult.data as FoodEntry[] || [];
      }

      const waterMl = hydrationResult.error
        ? summaryResult.data?.water_ml || 0
        : (hydrationResult.data ?? []).reduce((sum, log) => sum + (log.amount_ml ?? 0), 0);
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

      const occurredAtUtc = fullEntry.logged_at ?? new Date().toISOString();
      const mealSource = fullEntry.source ?? 'scan';
      const { data: insertedMeal, error: mealError } = await supabase
        .from('meals')
        .insert({
          user_id: user.id,
          occurred_at_local: toLocalTimestamp(new Date(occurredAtUtc)),
          occurred_at_utc: occurredAtUtc,
          total_calories: fullEntry.total_calories,
          total_protein: fullEntry.protein_g ?? 0,
          total_carbs: fullEntry.carbs_g ?? 0,
          total_fat: fullEntry.fat_g ?? 0,
          source: mealSource,
          image_url: fullEntry.image_url ?? null,
        })
        .select()
        .single();

      let insertedEntry: FoodEntry;
      if (!mealError && insertedMeal) {
        const meal = insertedMeal as MealRow;
        const { data: insertedItems, error: itemsError } = await supabase
          .from('food_items')
          .insert(fullEntry.food_items.map((item) => ({
            meal_id: meal.id,
            name: item.name,
            calories: item.calories,
            protein: item.protein_g,
            carbs: item.carbs_g,
            fat: item.fat_g,
            portion_size_tier: item.portion_size_tier ?? null,
            grams: item.grams ?? null,
          })))
          .select();
        if (itemsError) throw itemsError;

        // Manual entries have no AI prediction — skip the contrastive-pair log.
        if (mealSource === 'scan') {
          const feedbackType = fullEntry.user_corrections?.length
            ? 'edited'
            : fullEntry.user_accepted_without_edit
              ? 'thumbs_up'
              : 'thumbs_down';
          await supabase.from('scan_feedback').insert({
            meal_id: meal.id,
            food_item_id: ((insertedItems ?? []) as FoodItemRow[])[0]?.id ?? null,
            user_id: user.id,
            raw_model_prediction: fullEntry.raw_ai_response ?? {},
            user_corrected_values: fullEntry.user_corrections?.length
              ? { corrections: fullEntry.user_corrections }
              : null,
            feedback_type: feedbackType,
          });
        }

        insertedEntry = {
          ...mealToFoodEntry({ ...meal, food_items: (insertedItems ?? []) as FoodItemRow[] }),
          meal_name: fullEntry.meal_name,
          raw_ai_response: fullEntry.raw_ai_response ?? null,
          user_corrections: fullEntry.user_corrections ?? null,
          user_accepted_without_edit: fullEntry.user_accepted_without_edit,
          is_cheat_day: fullEntry.is_cheat_day,
        };
      } else {
        const { data: legacyEntry, error: insertError } = await supabase
          .from('food_entries')
          .insert(fullEntry)
          .select()
          .single();
        if (insertError) throw insertError;
        insertedEntry = legacyEntry as FoodEntry;
      }

      // Update local state
      const { entries, waterMl, isCheatDay } = get();
      const newEntries = [insertedEntry, ...entries];
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
      await trackEvent('scan_completed', { item_count: insertedEntry.food_items.length });

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

      const mealDelete = await supabase
        .from('meals')
        .delete()
        .eq('id', id);

      if (mealDelete.error) {
        const { error } = await supabase
          .from('food_entries')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }

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
      const { waterMl, entries, isCheatDay } = get();
      const newWaterMl = waterMl + ml;

      set({ waterMl: newWaterMl });

      const today = getTodayDate();
      const newSummary = buildSummary(today, user.id, entries, newWaterMl, isCheatDay);

      const now = new Date();
      const hydrationResult = await supabase
        .from('hydration_logs')
        .insert({
          user_id: user.id,
          amount_ml: ml,
          source: 'in_app',
          occurred_at_local: toLocalTimestamp(now),
          occurred_at_utc: now.toISOString(),
        });

      if (hydrationResult.error) {
        await supabase
          .from('daily_summaries')
          .upsert({
            user_id: user.id,
            date: today,
            water_ml: newWaterMl,
          }, { onConflict: 'user_id,date' });
      }

      set({ summary: newSummary });
      await trackEvent('hydration_logged', { amount: ml, source: 'in_app' });
    } catch (e) {
      console.error('Add water error:', e);
    }
  },

  clearError: () => set({ error: null }),
}));
