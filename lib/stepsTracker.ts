/**
 * Pedometer integration via expo-sensors. Lazy-required so the app still
 * boots on a dev build that pre-dates the native module — features degrade
 * silently when the require fails.
 *
 * Platform notes:
 *   - iOS:  `getStepCountAsync(start, end)` returns today's running total.
 *   - Android: `getStepCountAsync` is unsupported; we rely on `watchStepCount`
 *     which streams the delta since subscription start. The activity store
 *     combines a persisted baseline with the streamed delta.
 */

import { supabase } from './supabase';
import { logSupabaseError } from './supabaseError';

type PedometerModule = typeof import('expo-sensors').Pedometer | null;

function loadPedometer(): PedometerModule {
  try {
    const mod = require('expo-sensors') as typeof import('expo-sensors');
    return mod.Pedometer;
  } catch {
    return null;
  }
}

export async function isStepTrackingAvailable(): Promise<boolean> {
  const Pedometer = loadPedometer();
  if (!Pedometer) return false;
  try {
    return await Pedometer.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function requestStepPermission(): Promise<boolean> {
  const Pedometer = loadPedometer();
  if (!Pedometer) return false;
  try {
    const result = await Pedometer.requestPermissionsAsync();
    return result.granted ?? result.status === 'granted';
  } catch {
    return false;
  }
}

/** Best-effort total steps since local midnight. 0 on Android (use watch). */
export async function getTodaySteps(): Promise<number> {
  const Pedometer = loadPedometer();
  if (!Pedometer) return 0;
  try {
    if (!(await Pedometer.isAvailableAsync())) return 0;
    const end = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    // getStepCountAsync is iOS-only — Android throws "Unsupported".
    const res = await Pedometer.getStepCountAsync(start, end);
    return res?.steps ?? 0;
  } catch {
    return 0;
  }
}

export interface StepSubscription {
  remove: () => void;
}

/** Subscribe to live step increments. Returns a remover. */
export function watchSteps(onUpdate: (sessionSteps: number) => void): StepSubscription | null {
  const Pedometer = loadPedometer();
  if (!Pedometer) return null;
  try {
    return Pedometer.watchStepCount((result) => {
      onUpdate(result?.steps ?? 0);
    });
  } catch {
    return null;
  }
}

export async function syncStepsToSupabase(userId: string, stepCount: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const { error } = await supabase
      .from('steps_logs')
      .upsert(
        {
          user_id: userId,
          date: today,
          step_count: stepCount,
          source: 'pedometer',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date' },
      );
    logSupabaseError('steps_logs.upsert', error);
  } catch (error) {
    console.warn('[Steps] sync threw:', error);
  }
}

export async function loadTodayStepsFromSupabase(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data, error } = await supabase
      .from('steps_logs')
      .select('step_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();
    if (error) {
      logSupabaseError('steps_logs.select', error);
      return 0;
    }
    return data?.step_count ?? 0;
  } catch {
    return 0;
  }
}
