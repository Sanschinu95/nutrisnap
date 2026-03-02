/**
 * Daily food and water tracking store using Zustand
 * MOCK version — no Supabase, all data lives in memory
 */

import { create } from 'zustand';
import type { FoodEntry, DailySummary } from '@/types/nutrition';
import type { FoodEntryInsert } from '@/types/database';

interface DailyState {
  entries: FoodEntry[];
  summary: DailySummary | null;
  isCheatDay: boolean;
  waterMl: number;
  isLoading: boolean;
  error: string | null;
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
  return new Date().toISOString().split('T')[0];
}

let nextEntryId = 1;

function makeId(): string {
  return `mock-entry-${nextEntryId++}-${Date.now()}`;
}

// Default empty summary for "today"
function emptyDailySummary(): DailySummary {
  return {
    id: `mock-summary-${getTodayDate()}`,
    user_id: 'local-mock-user-0001',
    date: getTodayDate(),
    total_calories: 0,
    total_protein: 0,
    total_carbs: 0,
    total_fat: 0,
    water_ml: 0,
    is_cheat_day: false,
    goal_met: false,
  };
}

export const useDailyStore = create<DailyStore>((set, get) => ({
  // State
  entries: [],
  summary: emptyDailySummary(),
  isCheatDay: false,
  waterMl: 0,
  isLoading: false,
  error: null,

  // Actions — all in-memory, no network calls

  loadToday: async () => {
    // If summary already exists we keep it; otherwise create a blank one
    const { summary } = get();
    if (!summary || summary.date !== getTodayDate()) {
      set({ summary: emptyDailySummary(), entries: [], waterMl: 0, isCheatDay: false });
    }
  },

  addEntry: async (entry) => {
    try {
      set({ isLoading: true, error: null });

      const newEntry: FoodEntry = {
        id: makeId(),
        user_id: 'local-mock-user-0001',
        meal_name: entry.meal_name,
        food_items: entry.food_items,
        total_calories: entry.total_calories ?? 0,
        protein_g: entry.protein_g ?? null,
        carbs_g: entry.carbs_g ?? null,
        fat_g: entry.fat_g ?? null,
        fiber_g: entry.fiber_g ?? null,
        image_url: entry.image_url ?? null,
        raw_gemini_response: entry.raw_gemini_response ?? null,
        user_corrections: entry.user_corrections ?? null,
        user_accepted_without_edit: entry.user_accepted_without_edit ?? true,
        is_cheat_day: entry.is_cheat_day ?? false,
        logged_at: entry.logged_at ?? new Date().toISOString(),
      };

      const { summary } = get();
      const updatedSummary = summary
        ? {
            ...summary,
            total_calories: summary.total_calories + (entry.total_calories ?? 0),
            total_protein: summary.total_protein + (entry.protein_g ?? 0),
            total_carbs: summary.total_carbs + (entry.carbs_g ?? 0),
            total_fat: summary.total_fat + (entry.fat_g ?? 0),
          }
        : null;

      set((state) => ({
        entries: [newEntry, ...state.entries],
        summary: updatedSummary,
        isLoading: false,
      }));

      return { success: true };
    } catch (error) {
      console.error('Add entry error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  removeEntry: async (id: string) => {
    const { entries, summary } = get();
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    set({
      entries: entries.filter((e) => e.id !== id),
      summary: summary
        ? {
            ...summary,
            total_calories: Math.max(0, summary.total_calories - entry.total_calories),
            total_protein: Math.max(0, summary.total_protein - (entry.protein_g ?? 0)),
            total_carbs: Math.max(0, summary.total_carbs - (entry.carbs_g ?? 0)),
            total_fat: Math.max(0, summary.total_fat - (entry.fat_g ?? 0)),
          }
        : null,
    });
  },

  toggleCheatDay: async () => {
    const { summary, isCheatDay } = get();
    const newCheatDay = !isCheatDay;
    set({
      isCheatDay: newCheatDay,
      summary: summary ? { ...summary, is_cheat_day: newCheatDay } : null,
    });
  },

  addWater: async (ml: number) => {
    const { summary, waterMl } = get();
    const newWaterMl = waterMl + ml;
    set({
      waterMl: newWaterMl,
      summary: summary ? { ...summary, water_ml: newWaterMl } : null,
    });
  },

  clearError: () => set({ error: null }),
}));
