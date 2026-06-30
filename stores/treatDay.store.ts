/**
 * Treat-day store. Tracks the unlocked-but-unused row plus any row that's
 * been activated today so the Home screen can switch into "treat day mode".
 *
 * `justUnlocked` triggers the full-screen celebration overlay; it's set when
 * the most recent unlock is within the last 5 minutes AND the user hasn't
 * already dismissed it via markUnlockSeen.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  activateTreatDay,
  getActiveTreatDay,
  isTreatDayActiveToday,
  unlockTreatDay as unlockTreatDayRow,
  type TreatDayRow,
} from '../lib/treatDay';
import { supabase } from '../lib/supabase';
import { logSupabaseError } from '../lib/supabaseError';
import type { Profile } from '@/types/database';

const UNLOCK_SEEN_PREFIX = 'treat_day_unlock_seen';

interface TreatDayState {
  availableTreatDay: TreatDayRow | null;
  activeTreatDayToday: TreatDayRow | null;
  justUnlocked: boolean;
  currentUserId: string | null;
}

interface TreatDayActions {
  loadTreatDayState: (userId: string) => Promise<void>;
  unlockNow: (userId: string, reason: string, profile: Profile | null) => Promise<TreatDayRow | null>;
  activateToday: (userId: string) => Promise<TreatDayRow | null>;
  /** Persistently mark the celebration as seen for this specific row. */
  markUnlockSeen: () => Promise<void>;
  reset: () => void;
}

const initial: TreatDayState = {
  availableTreatDay: null,
  activeTreatDayToday: null,
  justUnlocked: false,
  currentUserId: null,
};

function seenKey(userId: string, treatId: string): string {
  return `${UNLOCK_SEEN_PREFIX}_${userId}_${treatId}`;
}

export const useTreatDayStore = create<TreatDayState & TreatDayActions>((set, get) => ({
  ...initial,

  loadTreatDayState: async (userId) => {
    if (get().currentUserId !== userId) {
      set({ ...initial, currentUserId: userId });
    }
    const [available, activeToday] = await Promise.all([
      getActiveTreatDay(userId),
      isTreatDayActiveToday(userId),
    ]);

    let justUnlocked = false;
    if (available) {
      const unlockedAt = new Date(available.unlocked_at).getTime();
      const recent = Date.now() - unlockedAt < 24 * 60 * 60 * 1000; // surface for 24h
      if (recent) {
        const seen = await AsyncStorage.getItem(seenKey(userId, available.id)).catch(() => null);
        justUnlocked = !seen;
      }
    }

    set({
      availableTreatDay: available,
      activeTreatDayToday: activeToday,
      justUnlocked,
    });
  },

  unlockNow: async (userId, reason, profile) => {
    const row = await unlockTreatDayRow(userId, reason, profile);
    if (row) {
      set({ availableTreatDay: row, justUnlocked: true });
    }
    return row;
  },

  activateToday: async (userId) => {
    const available = get().availableTreatDay;
    if (!available) return null;
    await activateTreatDay(available.id, userId);
    // Refresh both views.
    const [refreshedAvailable, activeToday] = await Promise.all([
      getActiveTreatDay(userId),
      isTreatDayActiveToday(userId),
    ]);
    set({
      availableTreatDay: refreshedAvailable,
      activeTreatDayToday: activeToday,
      justUnlocked: false,
    });
    // Mark this specific row as celebration-seen so it doesn't pop again.
    await AsyncStorage.setItem(seenKey(userId, available.id), '1').catch(() => {});
    return activeToday;
  },

  markUnlockSeen: async () => {
    const { availableTreatDay, currentUserId } = get();
    if (!availableTreatDay || !currentUserId) {
      set({ justUnlocked: false });
      return;
    }
    await AsyncStorage.setItem(seenKey(currentUserId, availableTreatDay.id), '1').catch(() => {});
    set({ justUnlocked: false });
  },

  reset: () => set({ ...initial }),
}));

/** Update a meal source enum check needs to allow 'treat_day'. */
export async function logTreatItemAsMeal(args: {
  userId: string;
  name: string;
  calories: number;
}): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const occurredAtUtc = now.toISOString();
  const occurredAtLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);

  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .insert({
      user_id: args.userId,
      occurred_at_local: occurredAtLocal,
      occurred_at_utc: occurredAtUtc,
      total_calories: Math.max(0, Math.round(args.calories)),
      total_protein: 0,
      total_carbs: 0,
      total_fat: 0,
      source: 'treat_day',
      image_url: null,
    })
    .select()
    .single();

  if (mealError || !meal) {
    logSupabaseError('meals.insert(treat_day)', mealError);
    return { success: false, error: mealError?.message };
  }

  const { error: itemsError } = await supabase
    .from('food_items')
    .insert([
      {
        meal_id: meal.id,
        name: args.name,
        calories: Math.max(0, Math.round(args.calories)),
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    ]);
  logSupabaseError('food_items.insert(treat_day)', itemsError);

  return { success: true };
}
