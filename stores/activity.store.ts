/**
 * Activity tracking: steps (auto, pedometer-driven) + sleep (semi-auto,
 * confirmed by a morning prompt). Both back to Supabase tables created by
 * docs/migration_steps_sleep.sql.
 *
 * The pedometer subscription is kept on this module rather than in a
 * component so re-renders never tear the watch down. Steps sync to Supabase
 * is debounced (every 100 incremental steps).
 */

import { create } from 'zustand';
import {
  getTodaySteps,
  loadTodayStepsFromSupabase,
  syncStepsToSupabase,
  watchSteps,
  type StepSubscription,
} from '../lib/stepsTracker';
import { supabase } from '../lib/supabase';
import { logSupabaseError } from '../lib/supabaseError';

export interface SleepLog {
  sleepTime: Date;
  wakeTime: Date;
  durationMinutes: number;
}

interface ActivityState {
  todaySteps: number;
  stepGoal: number;
  stepPermissionGranted: boolean;
  stepTrackingAvailable: boolean;

  lastNightSleep: SleepLog | null;
  sleepConfirmationPending: boolean;
  regularSleepTime: string; // 'HH:MM'
  regularWakeTime: string;
  sleepGoalHours: number;

  /** Monotonically increasing tick — bumping it asks listeners to open the sleep sheet. */
  sleepSheetOpenRequest: number;

  currentUserId: string | null;
}

interface ActivityActions {
  initialize: (userId: string) => Promise<void>;
  refreshSteps: () => Promise<void>;
  setStepGoal: (userId: string, goal: number) => Promise<void>;
  updateSleepSchedule: (userId: string, sleepTime: string, wakeTime: string) => Promise<void>;
  confirmLastNightSleep: (userId: string) => Promise<void>;
  editAndConfirmSleep: (userId: string, sleepTime: Date, wakeTime: Date) => Promise<void>;
  dismissSleepPrompt: () => void;
  checkSleepPromptStatus: (userId: string) => Promise<void>;
  requestOpenSleepSheet: () => void;
  reset: () => void;
}

const initial: ActivityState = {
  todaySteps: 0,
  stepGoal: 8000,
  stepPermissionGranted: false,
  stepTrackingAvailable: false,
  lastNightSleep: null,
  sleepConfirmationPending: false,
  regularSleepTime: '23:00',
  regularWakeTime: '07:00',
  sleepGoalHours: 8.0,
  sleepSheetOpenRequest: 0,
  currentUserId: null,
};

// Module-scoped subscription so React re-renders don't churn the pedometer watch.
let pedometerSub: StepSubscription | null = null;
let lastSyncedStepCount = 0;
let watchBaseline = 0;

export const useActivityStore = create<ActivityState & ActivityActions>((set, get) => ({
  ...initial,

  initialize: async (userId) => {
    if (get().currentUserId !== userId) {
      // Tear down any previous user's watch before re-initing.
      pedometerSub?.remove();
      pedometerSub = null;
      set({ ...initial, currentUserId: userId });
    }

    await loadSleepPreferences(userId, set);
    await loadLastNightSleep(userId, set);

    // Step count: prefer pedometer; fall back to whatever Supabase already has.
    const fromDevice = await getTodaySteps();
    const fromSupabase = await loadTodayStepsFromSupabase(userId);
    const initialSteps = Math.max(fromDevice, fromSupabase);
    set({ todaySteps: initialSteps });
    watchBaseline = initialSteps;
    lastSyncedStepCount = initialSteps;

    if (initialSteps > 0 && fromDevice > fromSupabase) {
      await syncStepsToSupabase(userId, initialSteps);
      lastSyncedStepCount = initialSteps;
    }

    // Subscribe to live updates. The watch reports cumulative steps since
    // subscription start; combine with the baseline we captured above.
    if (!pedometerSub) {
      pedometerSub = watchSteps(async (sessionSteps) => {
        const updated = watchBaseline + sessionSteps;
        set({ todaySteps: updated });
        if (updated - lastSyncedStepCount >= 100) {
          lastSyncedStepCount = updated;
          await syncStepsToSupabase(get().currentUserId ?? userId, updated);
        }
      });
      if (pedometerSub) set({ stepTrackingAvailable: true, stepPermissionGranted: true });
    }

    await get().checkSleepPromptStatus(userId);
  },

  refreshSteps: async () => {
    const userId = get().currentUserId;
    if (!userId) return;
    const steps = await getTodaySteps();
    if (steps > get().todaySteps) {
      set({ todaySteps: steps });
      watchBaseline = steps;
      lastSyncedStepCount = steps;
      await syncStepsToSupabase(userId, steps);
    }
  },

  setStepGoal: async (userId, goal) => {
    set({ stepGoal: goal });
    const { error } = await supabase
      .from('profiles')
      .update({ step_goal: goal })
      .eq('id', userId);
    logSupabaseError('profiles.update(step_goal)', error);
  },

  updateSleepSchedule: async (userId, sleepTime, wakeTime) => {
    set({ regularSleepTime: sleepTime, regularWakeTime: wakeTime });
    const { error } = await supabase
      .from('profiles')
      .update({ regular_sleep_time: sleepTime, regular_wake_time: wakeTime })
      .eq('id', userId);
    logSupabaseError('profiles.update(sleep_schedule)', error);
  },

  checkSleepPromptStatus: async (userId) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();

    const { data, error } = await supabase
      .from('sleep_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();
    if (error) logSupabaseError('sleep_logs.select', error);

    set({ sleepConfirmationPending: !data && hour >= 6 && hour <= 11 });
  },

  confirmLastNightSleep: async (userId) => {
    const state = get();
    const [sleepH, sleepM] = parseTime(state.regularSleepTime);
    const [wakeH, wakeM] = parseTime(state.regularWakeTime);
    const today = new Date();
    const sleepTime = new Date(today);
    sleepTime.setDate(sleepTime.getDate() - 1);
    sleepTime.setHours(sleepH, sleepM, 0, 0);
    const wakeTime = new Date(today);
    wakeTime.setHours(wakeH, wakeM, 0, 0);
    await get().editAndConfirmSleep(userId, sleepTime, wakeTime);
  },

  editAndConfirmSleep: async (userId, sleepTime, wakeTime) => {
    // Guard against wake-before-sleep input (user picked sleep PM tomorrow).
    let sleep = sleepTime;
    let wake = wakeTime;
    if (wake.getTime() <= sleep.getTime()) {
      // Assume sleep was previous evening.
      sleep = new Date(wake);
      sleep.setDate(sleep.getDate() - 1);
      sleep.setHours(sleepTime.getHours(), sleepTime.getMinutes(), 0, 0);
    }
    const durationMinutes = Math.max(
      0,
      Math.round((wake.getTime() - sleep.getTime()) / 60000),
    );
    const date = wake.toISOString().split('T')[0];

    const { error } = await supabase.from('sleep_logs').upsert(
      {
        user_id: userId,
        date,
        sleep_time: sleep.toISOString(),
        wake_time: wake.toISOString(),
        duration_minutes: durationMinutes,
        source: 'confirmed',
      },
      { onConflict: 'user_id,date' },
    );
    logSupabaseError('sleep_logs.upsert', error);

    set({
      lastNightSleep: { sleepTime: sleep, wakeTime: wake, durationMinutes },
      sleepConfirmationPending: false,
    });
  },

  dismissSleepPrompt: () => set({ sleepConfirmationPending: false }),

  requestOpenSleepSheet: () =>
    set((s) => ({ sleepSheetOpenRequest: s.sleepSheetOpenRequest + 1 })),

  reset: () => {
    pedometerSub?.remove();
    pedometerSub = null;
    lastSyncedStepCount = 0;
    watchBaseline = 0;
    set({ ...initial });
  },
}));

/* ─── helpers ────────────────────────────────────────────────── */

async function loadSleepPreferences(
  userId: string,
  set: (partial: Partial<ActivityState>) => void,
): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('regular_sleep_time, regular_wake_time, sleep_goal_hours, step_goal')
    .eq('id', userId)
    .single();
  if (error) {
    logSupabaseError('profiles.select(sleep_prefs)', error);
    return;
  }
  if (!data) return;
  set({
    regularSleepTime: trimSeconds(data.regular_sleep_time) || '23:00',
    regularWakeTime: trimSeconds(data.regular_wake_time) || '07:00',
    sleepGoalHours: data.sleep_goal_hours ?? 8.0,
    stepGoal: data.step_goal ?? 8000,
  });
}

async function loadLastNightSleep(
  userId: string,
  set: (partial: Partial<ActivityState>) => void,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sleep_logs')
    .select('sleep_time, wake_time, duration_minutes')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  if (error) {
    logSupabaseError('sleep_logs.select(today)', error);
    return;
  }
  if (!data) return;
  set({
    lastNightSleep: {
      sleepTime: new Date(data.sleep_time),
      wakeTime: new Date(data.wake_time),
      durationMinutes: data.duration_minutes,
    },
  });
}

function parseTime(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}

/** Supabase TIME columns come back as 'HH:MM:SS'. We want 'HH:MM'. */
function trimSeconds(value: string | null | undefined): string {
  if (!value) return '';
  const parts = value.split(':');
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : value;
}
