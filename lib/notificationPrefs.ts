/**
 * Notification preferences — types, defaults, and persistence.
 *
 * Authenticated users: `notification_preferences` table (one row per user,
 * auto-created by a DB trigger; see docs/migration_notifications.sql).
 * Guests (`guest_*` ids): AsyncStorage only, cleared on sign-out so the next
 * account on the device starts from defaults.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { logSupabaseError } from './supabaseError';

export interface NotificationPreferences {
  notifications_enabled: boolean;

  meal_reminders_enabled: boolean;
  hydration_reminders_enabled: boolean;
  sleep_reminders_enabled: boolean;
  streak_reminders_enabled: boolean;
  encouragement_enabled: boolean;
  checkin_enabled: boolean;

  /** 'HH:MM' */
  breakfast_time: string;
  lunch_time: string;
  snack_time: string;
  dinner_time: string;

  hydration_interval_hours: number;
  hydration_start_hour: number;
  hydration_end_hour: number;

  /** 'HH:MM' — wind-down reminder time. */
  sleep_reminder_time: string;
  wake_confirmation_hour: number;

  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  notifications_enabled: true,
  meal_reminders_enabled: true,
  hydration_reminders_enabled: true,
  sleep_reminders_enabled: true,
  streak_reminders_enabled: true,
  encouragement_enabled: true,
  checkin_enabled: true,
  breakfast_time: '08:30',
  lunch_time: '13:00',
  snack_time: '17:00',
  dinner_time: '20:00',
  hydration_interval_hours: 2,
  hydration_start_hour: 8,
  hydration_end_hour: 22,
  sleep_reminder_time: '22:30',
  wake_confirmation_hour: 8,
  quiet_hours_enabled: true,
  quiet_hours_start: '23:00',
  quiet_hours_end: '07:00',
};

const GUEST_PREFS_KEY = 'nyurix.notif.prefs.v1';

export function isGuestId(userId: string | null | undefined): boolean {
  return !userId || userId.startsWith('guest_');
}

// ─── Quiet hours ────────────────────────────────────────────────

export function isWithinQuietHours(
  prefs: NotificationPreferences,
  hour: number,
  minute: number,
): boolean {
  if (!prefs.quiet_hours_enabled) return false;
  const [startH, startM] = prefs.quiet_hours_start.split(':').map(Number);
  const [endH, endM] = prefs.quiet_hours_end.split(':').map(Number);
  const t = hour * 60 + minute;
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (start === end) return false;
  // Wrap-around window (e.g. 23:00 → 07:00)
  if (start > end) return t >= start || t < end;
  return t >= start && t < end;
}

export function isWithinQuietHoursNow(prefs: NotificationPreferences): boolean {
  const now = new Date();
  return isWithinQuietHours(prefs, now.getHours(), now.getMinutes());
}

/** Postgres TIME comes back as 'HH:MM:SS' — normalize to 'HH:MM'. */
function toHHMM(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const match = value.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : fallback;
}

function normalizeRow(row: Record<string, unknown>): NotificationPreferences {
  const d = DEFAULT_NOTIFICATION_PREFS;
  const bool = (key: keyof NotificationPreferences) =>
    typeof row[key] === 'boolean' ? (row[key] as boolean) : (d[key] as boolean);
  const int = (key: keyof NotificationPreferences) =>
    typeof row[key] === 'number' && Number.isFinite(row[key])
      ? Math.round(row[key] as number)
      : (d[key] as number);
  return {
    notifications_enabled: bool('notifications_enabled'),
    meal_reminders_enabled: bool('meal_reminders_enabled'),
    hydration_reminders_enabled: bool('hydration_reminders_enabled'),
    sleep_reminders_enabled: bool('sleep_reminders_enabled'),
    streak_reminders_enabled: bool('streak_reminders_enabled'),
    encouragement_enabled: bool('encouragement_enabled'),
    checkin_enabled: bool('checkin_enabled'),
    breakfast_time: toHHMM(row.breakfast_time, d.breakfast_time),
    lunch_time: toHHMM(row.lunch_time, d.lunch_time),
    snack_time: toHHMM(row.snack_time, d.snack_time),
    dinner_time: toHHMM(row.dinner_time, d.dinner_time),
    hydration_interval_hours: int('hydration_interval_hours'),
    hydration_start_hour: int('hydration_start_hour'),
    hydration_end_hour: int('hydration_end_hour'),
    sleep_reminder_time: toHHMM(row.sleep_reminder_time, d.sleep_reminder_time),
    wake_confirmation_hour: int('wake_confirmation_hour'),
    quiet_hours_enabled: bool('quiet_hours_enabled'),
    quiet_hours_start: toHHMM(row.quiet_hours_start, d.quiet_hours_start),
    quiet_hours_end: toHHMM(row.quiet_hours_end, d.quiet_hours_end),
  };
}

export async function loadNotificationPrefs(
  userId: string | null,
): Promise<NotificationPreferences> {
  if (isGuestId(userId)) {
    try {
      const raw = await AsyncStorage.getItem(GUEST_PREFS_KEY);
      if (raw) return normalizeRow(JSON.parse(raw));
    } catch {
      await AsyncStorage.removeItem(GUEST_PREFS_KEY);
    }
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logSupabaseError('notification_preferences.select', error);
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
  if (!data) {
    // Trigger normally creates the row; cover pre-migration accounts.
    const { error: insertError } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (insertError) logSupabaseError('notification_preferences.insert', insertError);
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
  return normalizeRow(data as Record<string, unknown>);
}

export async function saveNotificationPrefs(
  userId: string | null,
  prefs: NotificationPreferences,
): Promise<void> {
  if (isGuestId(userId)) {
    try {
      await AsyncStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Guest notification prefs save failed:', e);
    }
    return;
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) logSupabaseError('notification_preferences.upsert', error);
}

/** Sign-out hygiene: the next user (or guest) starts from defaults. */
export async function clearLocalNotificationPrefs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_PREFS_KEY);
  } catch {
    // Best-effort.
  }
}
