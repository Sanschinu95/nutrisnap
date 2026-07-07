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
  isStepTrackingAvailable,
  loadTodayStepsFromSupabase,
  requestStepPermission,
  syncStepsToSupabase,
  watchSteps,
  type StepSubscription,
} from '../lib/stepsTracker';
import {
  getTodayStepsFromHealthConnect,
  isHealthConnectAvailable,
  requestHealthConnectStepPermission,
} from '../lib/healthConnect';
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
// Which source is driving step counts, plus the Health Connect poll timer
// (Health Connect has no live stream, so we re-read its daily total on a timer).
let stepSource: 'health_connect' | 'pedometer' | null = null;
let hcInterval: ReturnType<typeof setInterval> | null = null;

/** Re-read Health Connect's daily total and sync it when it moves. */
async function syncHealthConnectSteps(
  fallbackUserId: string,
  set: (partial: Partial<ActivityState>) => void,
  getUserId: () => string | null,
): Promise<void> {
  const steps = await getTodayStepsFromHealthConnect();
  if (steps == null) return; // permission lost / unavailable — leave last value
  set({ todaySteps: steps });
  if (Math.abs(steps - lastSyncedStepCount) >= 50) {
    lastSyncedStepCount = steps;
    await syncStepsToSupabase(getUserId() ?? fallbackUserId, steps);
  }
}

export const useActivityStore = create<ActivityState & ActivityActions>((set, get) => ({
  ...initial,

  initialize: async (userId) => {
    if (get().currentUserId !== userId) {
      // Tear down any previous user's watch/poll before re-initing.
      pedometerSub?.remove();
      pedometerSub = null;
      if (hcInterval) { clearInterval(hcInterval); hcInterval = null; }
      stepSource = null;
      set({ ...initial, currentUserId: userId });
    }

    await loadSleepPreferences(userId, set);
    await loadLastNightSleep(userId, set);

    // ── Steps ────────────────────────────────────────────────────────────
    // Prefer Health Connect (reads the phone's aggregated fitness data — what
    // Google Fit / Samsung Health / the built-in tracker record, counted even
    // while the app is closed). Fall back to the raw pedometer sensor.
    const fromSupabase = await loadTodayStepsFromSupabase(userId);
    set({ todaySteps: fromSupabase });
    lastSyncedStepCount = fromSupabase;

    let usingHealthConnect = false;
    if (await isHealthConnectAvailable()) {
      const granted = await requestHealthConnectStepPermission();
      if (granted) {
        usingHealthConnect = true;
        stepSource = 'health_connect';
        set({ stepTrackingAvailable: true, stepPermissionGranted: true });
        await syncHealthConnectSteps(userId, set, () => get().currentUserId);
        // No live stream — poll the daily total while the app is open.
        if (hcInterval) clearInterval(hcInterval);
        hcInterval = setInterval(() => {
          syncHealthConnectSteps(userId, set, () => get().currentUserId).catch(() => {});
        }, 60_000);
      }
    }

    if (!usingHealthConnect) {
      // Pedometer fallback (raw hardware sensor). Android's step counter needs
      // the ACTIVITY_RECOGNITION runtime permission before watchStepCount emits.
      stepSource = 'pedometer';
      const fromDevice = await getTodaySteps();
      const initialSteps = Math.max(fromDevice, fromSupabase);
      set({ todaySteps: initialSteps });
      watchBaseline = initialSteps;
      lastSyncedStepCount = initialSteps;
      if (initialSteps > 0 && fromDevice > fromSupabase) {
        await syncStepsToSupabase(userId, initialSteps);
      }

      const available = await isStepTrackingAvailable();
      const granted = available ? await requestStepPermission() : false;
      set({ stepTrackingAvailable: available, stepPermissionGranted: granted });

      if (available && granted && !pedometerSub) {
        pedometerSub = watchSteps(async (sessionSteps) => {
          const updated = watchBaseline + sessionSteps;
          set({ todaySteps: updated });
          if (updated - lastSyncedStepCount >= 100) {
            lastSyncedStepCount = updated;
            await syncStepsToSupabase(get().currentUserId ?? userId, updated);
          }
        });
      }
    }

    await get().checkSleepPromptStatus(userId);
  },

  refreshSteps: async () => {
    const userId = get().currentUserId;
    if (!userId) return;
    if (stepSource === 'health_connect') {
      await syncHealthConnectSteps(userId, set, () => get().currentUserId);
      return;
    }
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
    // Both anchored to today; editAndConfirmSleep decides whether sleep was the
    // previous evening or after midnight based on the clock times.
    const sleepTime = new Date();
    sleepTime.setHours(sleepH, sleepM, 0, 0);
    const wakeTime = new Date();
    wakeTime.setHours(wakeH, wakeM, 0, 0);
    await get().editAndConfirmSleep(userId, sleepTime, wakeTime);
  },

  editAndConfirmSleep: async (userId, sleepTime, wakeTime) => {
    // Normalize to a single night anchored on the WAKE day. Sleep onset lands on
    // the wake day unless its clock time is at/after the wake time — in which
    // case it was the previous evening. Only the clock time (h:m) of sleepTime
    // matters; its date is ignored. This is how sleep apps handle it and, unlike
    // the old "always yesterday" logic, correctly supports falling asleep after
    // midnight: sleep 01:00 → wake 08:00 = 7h, not 31h (the old +24h bug).
    const wake = new Date(wakeTime);
    const sleep = new Date(wake);
    sleep.setHours(sleepTime.getHours(), sleepTime.getMinutes(), 0, 0);
    if (sleep.getTime() >= wake.getTime()) {
      sleep.setDate(sleep.getDate() - 1);
    }
    // Clamp to a sane maximum so a bad input can never store a multi-day "night".
    const durationMinutes = Math.min(
      20 * 60,
      Math.max(0, Math.round((wake.getTime() - sleep.getTime()) / 60000)),
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
    if (hcInterval) { clearInterval(hcInterval); hcInterval = null; }
    stepSource = null;
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
