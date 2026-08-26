/**
 * Personality notification scheduler.
 *
 * Turns notification_preferences into a day of warm, rotating reminders:
 *   - Meals / hydration / sleep wind-down: DAILY repeating local triggers.
 *   - Sleep check-in: one-shot for the next morning (skipped when last
 *     night's sleep is already confirmed), refreshed on every app open.
 *   - Missed-you: a one-shot "dead man's switch" — every app open pushes it
 *     2 days out at 11:00, so it only ever fires after a fully-skipped day.
 *     No server push infra needed.
 *   - Encouragement: one-shot at 9pm on days with 3+ logged meals and a 5+
 *     streak, max once per 3 days.
 *
 * Attention budget: at most MAX_DAILY_NOTIFICATIONS repeating reminders per
 * day. Meals and sleep take priority; hydration fills the remaining slots
 * (when the day is full, the snack reminder gives way — chai time doubles as
 * a sip prompt anyway). Quiet hours drop any slot inside the window.
 *
 * Variety: variant picks are remembered per type for 7 days (AsyncStorage)
 * so the same line never repeats within a week. Repeating triggers only use
 * variants whose context can't go stale (name, sleep schedule); volatile
 * context (streak, weekend) is reserved for one-shots scheduled same-day.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { logSupabaseError } from './supabaseError';
import { trackEvent } from './telemetry';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
} from './notifications';
import {
  isGuestId,
  isWithinQuietHours,
  loadNotificationPrefs,
  type NotificationPreferences,
} from './notificationPrefs';
import {
  latestVariantFor,
  loadRecentVariants,
  recentIdsFor,
  rememberUse,
  renderCopy,
  saveRecentVariants,
  selectVariant,
  VARIANTS_BY_TYPE,
  type CopyContext,
  type CopyVariant,
  type PersonalityNotificationType,
  type RecentVariantMap,
} from './notificationCopy';
import { useUserStore } from '@/stores/user.store';
import { useStreakStore } from '@/stores/streak.store';
import { useActivityStore } from '@/stores/activity.store';
import { useAuthStore } from '@/stores/auth.store';
import { useDailyStore } from '@/stores/daily.store';

export const MAX_DAILY_NOTIFICATIONS = 6;

const MISSED_YOU_ID = 'personality-missed-you';
const ENCOURAGEMENT_ID = 'personality-encouragement';
const SLEEP_CHECKIN_ID = 'personality-sleep-checkin';

const MISSED_YOU_STATE_KEY = 'nyurix.notif.missedYou.v1';
const ENCOURAGEMENT_STAMP_KEY = 'nyurix.notif.lastEncouragement.v1';

const DYNAMIC_DEDUP_HOURS = 72; // encouragement / missed-you: max once per 3 days

/** Every type this scheduler cancels and rebuilds on each reschedule.
 * The legacy generic types are included so upgraded installs shed the old
 * robotic "🍽️ Meal Time" reminders automatically.
 * NOTE: 'encouragement' is deliberately absent — it's armed by meal logging,
 * not by the reschedule pass, so cancelling it here would kill a pending
 * same-day one-shot that nothing would re-create. It is cancelled explicitly
 * when its category (or the master switch) is turned off. */
const MANAGED_TYPES = new Set<string>([
  'meal_breakfast', 'meal_lunch', 'meal_snack', 'meal_dinner',
  'hydration', 'sleep_wind_down', 'sleep_check_in',
  'missed_you',
  'meal_reminder', 'water_reminder', // legacy
]);

// ─── Context ────────────────────────────────────────────────────

/** Context that stays true between reschedules — safe for repeating triggers. */
function buildStableContext(): CopyContext {
  const profile = useUserStore.getState().profile;
  const regularSleepTime = useActivityStore.getState().regularSleepTime;
  return {
    name: profile?.name ?? 'friend',
    sleepTimeHHMM: regularSleepTime || undefined,
  };
}

/** Full context — only for one-shots that fire within ~a day. */
function buildFullContext(): CopyContext {
  const streak = useStreakStore.getState().currentStreak;
  const day = new Date().getDay();
  return {
    ...buildStableContext(),
    streak: streak > 0 ? streak : undefined,
    isWeekend: day === 0 || day === 6,
  };
}

// ─── History (Supabase, auth users only, fire-and-forget) ───────

function logHistory(
  type: PersonalityNotificationType,
  variantId: string | null,
  interaction?: { type: 'opened' | 'action_taken'; at: Date },
): void {
  const userId = useAuthStore.getState().user?.id;
  if (!userId || isGuestId(userId)) return;
  supabase
    .from('notification_history')
    .insert({
      user_id: userId,
      notification_type: type,
      copy_variant_id: variantId,
      ...(interaction && {
        interacted_at: interaction.at.toISOString(),
        interaction_type: interaction.type,
      }),
    })
    .then(({ error }) => logSupabaseError('notification_history.insert', error));
}

/** Called by the notification-response listener when a personality
 * notification is tapped or a quick-add action is used. */
export function recordNotificationInteraction(
  type: string,
  variantId: string | null,
  interactionType: 'opened' | 'action_taken',
): void {
  if (!VARIANTS_BY_TYPE[type as PersonalityNotificationType]) return;
  logHistory(type as PersonalityNotificationType, variantId, {
    type: interactionType,
    at: new Date(),
  });
}

// ─── Core: reschedule everything ────────────────────────────────

interface DailySlot {
  type: PersonalityNotificationType;
  hour: number;
  minute: number;
  action: string;
  channel: string;
  categoryIdentifier?: string;
}

function parseHHMM(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(':').map(Number);
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}

let rescheduleInFlight: Promise<void> | null = null;

/**
 * Cancel and rebuild every scheduled personality notification from current
 * preferences. Call on app start, on foreground, and after prefs change.
 * Serialized: concurrent calls share one run.
 */
export function rescheduleAllPersonalityNotifications(
  prefsIn?: NotificationPreferences,
): Promise<void> {
  if (rescheduleInFlight) return rescheduleInFlight;
  rescheduleInFlight = doReschedule(prefsIn)
    .catch((e) => console.warn('Notification reschedule failed:', e))
    .finally(() => { rescheduleInFlight = null; });
  return rescheduleInFlight;
}

async function doReschedule(prefsIn?: NotificationPreferences): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();

  // Snapshot BEFORE cancelling — needed to detect whether the previously
  // scheduled missed-you one-shot fired while the app was away.
  const scheduledBefore = await Notifications.getAllScheduledNotificationsAsync();
  await settleMissedYouState(scheduledBefore);

  // Cancel everything we manage (leave coach weekly, treat day, streak-at-risk
  // and other event notifications alone — they have their own lifecycles).
  for (const notif of scheduledBefore) {
    const type = notif.content.data?.type;
    if (typeof type === 'string' && MANAGED_TYPES.has(type)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  if (status !== 'granted') {
    // Missed-you was cancelled above and won't be re-armed: forget its
    // scheduled time or the next settle pass would count it as fired.
    await clearMissedYouSchedule();
    return;
  }

  const userId = useAuthStore.getState().user?.id ?? useUserStore.getState().profile?.id ?? null;
  const prefs = prefsIn ?? (await loadNotificationPrefs(userId));
  if (!prefs.notifications_enabled) {
    await clearMissedYouSchedule();
    await Notifications.cancelScheduledNotificationAsync(ENCOURAGEMENT_ID).catch(() => {});
    return;
  }
  if (!prefs.encouragement_enabled) {
    await Notifications.cancelScheduledNotificationAsync(ENCOURAGEMENT_ID).catch(() => {});
  }

  const stableCtx = buildStableContext();
  const fullCtx = buildFullContext();
  const recent = await loadRecentVariants();
  const scheduledSummary: Record<string, string> = {};

  // ── Build the day's repeating slots within the attention budget ──
  const slots: DailySlot[] = [];
  const quiet = (h: number, m: number) => isWithinQuietHours(prefs, h, m);

  if (prefs.meal_reminders_enabled) {
    const meals: [PersonalityNotificationType, string][] = [
      ['meal_breakfast', prefs.breakfast_time],
      ['meal_lunch', prefs.lunch_time],
      ['meal_snack', prefs.snack_time],
      ['meal_dinner', prefs.dinner_time],
    ];
    for (const [type, time] of meals) {
      const [h, m] = parseHHMM(time);
      if (quiet(h, m)) continue;
      slots.push({
        type, hour: h, minute: m,
        action: 'open_scan',
        channel: NOTIFICATION_CHANNELS.MEAL_REMINDER,
      });
    }
  }

  if (prefs.sleep_reminders_enabled) {
    const [h, m] = parseHHMM(prefs.sleep_reminder_time);
    if (!quiet(h, m)) {
      slots.push({
        type: 'sleep_wind_down', hour: h, minute: m,
        action: 'open_home',
        channel: NOTIFICATION_CHANNELS.SLEEP_REMINDER,
      });
    }
  }

  // Sleep check-in is a one-shot (below) but counts against the budget.
  const checkInPlanned =
    prefs.sleep_reminders_enabled && !quiet(prefs.wake_confirmation_hour, 30);

  // Hydration fills whatever the budget leaves. When the day is already full
  // and hydration is on, the snack reminder gives way for one sip prompt.
  if (prefs.hydration_reminders_enabled) {
    let remaining = MAX_DAILY_NOTIFICATIONS - slots.length - (checkInPlanned ? 1 : 0);
    if (remaining <= 0) {
      const snackIdx = slots.findIndex((s) => s.type === 'meal_snack');
      if (snackIdx >= 0) {
        slots.splice(snackIdx, 1);
        remaining = 1;
      }
    }
    if (remaining > 0) {
      const hours: number[] = [];
      for (
        let h = prefs.hydration_start_hour;
        h <= prefs.hydration_end_hour;
        h += Math.max(1, prefs.hydration_interval_hours)
      ) {
        if (!quiet(h, 0)) hours.push(h);
      }
      const picked = sampleEvenly(hours, Math.min(remaining, hours.length));
      for (const h of picked) {
        slots.push({
          type: 'hydration', hour: h, minute: 0,
          action: 'open_hydration',
          channel: NOTIFICATION_CHANNELS.WATER_REMINDER,
          categoryIdentifier: NOTIFICATION_CATEGORIES.HYDRATION_QUICK_ADD,
        });
      }
    }
  }

  // ── Schedule the repeating slots ──
  for (const slot of slots) {
    const variant = selectVariant(
      VARIANTS_BY_TYPE[slot.type],
      stableCtx,
      recentIdsFor(recent, slot.type),
    );
    const copy = renderCopy(variant, stableCtx);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        data: { type: slot.type, variantId: variant.id, action: slot.action },
        ...(slot.categoryIdentifier && { categoryIdentifier: slot.categoryIdentifier }),
        ...(Platform.OS === 'android' && { channelId: slot.channel }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: slot.hour,
        minute: slot.minute,
      },
    });
    rememberUse(recent, slot.type, variant.id);
    scheduledSummary[`${slot.type}_${slot.hour}`] = variant.id;
  }

  // ── Sleep check-in: one-shot next morning ──
  if (checkInPlanned) {
    const variantId = await scheduleSleepCheckIn(prefs, fullCtx, recent);
    if (variantId) scheduledSummary.sleep_check_in = variantId;
  }

  // ── Missed-you dead man's switch ──
  if (prefs.checkin_enabled) {
    const variantId = await scheduleMissedYou(prefs, fullCtx, recent);
    if (variantId) scheduledSummary.missed_you = variantId;
  } else {
    await clearMissedYouSchedule();
  }

  await saveRecentVariants(recent);
  trackEvent('notification_scheduled', {
    count: Object.keys(scheduledSummary).length,
    schedule: scheduledSummary,
  });
}

/** Pick `count` items spread evenly across `items` (keeps order). */
function sampleEvenly(items: number[], count: number): number[] {
  if (count <= 0 || items.length === 0) return [];
  if (count >= items.length) return items;
  if (count === 1) return [items[Math.floor(items.length / 2)]];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(items[Math.round((i * (items.length - 1)) / (count - 1))]);
  }
  return [...new Set(out)];
}

async function scheduleSleepCheckIn(
  prefs: NotificationPreferences,
  ctx: CopyContext,
  recent: RecentVariantMap,
): Promise<string | null> {
  const target = new Date();
  target.setHours(prefs.wake_confirmation_hour, 30, 0, 0);

  // Push to tomorrow when today's slot already passed or last night's sleep
  // is already confirmed (the store tracks whether the morning prompt is due).
  const pending = useActivityStore.getState().sleepConfirmationPending;
  if (target.getTime() <= Date.now() || !pending) {
    target.setDate(target.getDate() + 1);
  }

  const variant = selectVariant(
    VARIANTS_BY_TYPE.sleep_check_in,
    ctx,
    recentIdsFor(recent, 'sleep_check_in'),
  );
  const copy = renderCopy(variant, ctx);
  await Notifications.scheduleNotificationAsync({
    identifier: SLEEP_CHECKIN_ID,
    content: {
      title: copy.title,
      body: copy.body,
      data: { type: 'sleep_check_in', variantId: variant.id, action: 'open_sleep_confirmation' },
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.SLEEP_REMINDER }),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
  });
  rememberUse(recent, 'sleep_check_in', variant.id);
  return variant.id;
}

// ─── Missed-you ─────────────────────────────────────────────────

interface MissedYouState {
  scheduledFor: string | null;
  variantId: string | null;
  lastFiredAt: string | null;
}

async function loadMissedYouState(): Promise<MissedYouState> {
  try {
    const raw = await AsyncStorage.getItem(MISSED_YOU_STATE_KEY);
    if (raw) return JSON.parse(raw) as MissedYouState;
  } catch { /* fall through */ }
  return { scheduledFor: null, variantId: null, lastFiredAt: null };
}

/** Forget a pending missed-you that was cancelled without re-arming, so the
 * settle pass can't misread its elapsed fire time as an actual fire. */
async function clearMissedYouSchedule(): Promise<void> {
  const state = await loadMissedYouState();
  if (!state.scheduledFor) return;
  await AsyncStorage.setItem(
    MISSED_YOU_STATE_KEY,
    JSON.stringify({
      scheduledFor: null,
      variantId: null,
      lastFiredAt: state.lastFiredAt,
    } satisfies MissedYouState),
  );
}

/** If the previously scheduled missed-you is gone from the scheduled list and
 * its fire time has passed, it fired — record that for the 3-day dedup. */
async function settleMissedYouState(
  scheduled: Notifications.NotificationRequest[],
): Promise<void> {
  const state = await loadMissedYouState();
  if (!state.scheduledFor) return;
  const stillScheduled = scheduled.some((n) => n.identifier === MISSED_YOU_ID);
  if (!stillScheduled && new Date(state.scheduledFor).getTime() <= Date.now()) {
    logHistory('missed_you', state.variantId);
    const next: MissedYouState = {
      scheduledFor: null,
      variantId: null,
      lastFiredAt: state.scheduledFor,
    };
    await AsyncStorage.setItem(MISSED_YOU_STATE_KEY, JSON.stringify(next));
  }
}

async function scheduleMissedYou(
  prefs: NotificationPreferences,
  ctx: CopyContext,
  recent: RecentVariantMap,
): Promise<string | null> {
  const state = await loadMissedYouState();

  // One check-in per absence: after it fires, wait 3 days before re-arming
  // (and a fired switch only re-arms when the user comes back anyway).
  if (
    state.lastFiredAt &&
    Date.now() - new Date(state.lastFiredAt).getTime() < DYNAMIC_DEDUP_HOURS * 60 * 60 * 1000
  ) {
    return null;
  }

  // Day after tomorrow at 11:00 — tomorrow must pass with no app open
  // (every open re-pushes this) before it can fire.
  const target = new Date();
  target.setDate(target.getDate() + 2);
  target.setHours(11, 0, 0, 0);
  if (isWithinQuietHours(prefs, 11, 0)) return null;

  const variant = selectVariant(
    VARIANTS_BY_TYPE.missed_you,
    ctx,
    recentIdsFor(recent, 'missed_you'),
  );
  const copy = renderCopy(variant, ctx);
  await Notifications.scheduleNotificationAsync({
    identifier: MISSED_YOU_ID,
    content: {
      title: copy.title,
      body: copy.body,
      data: { type: 'missed_you', variantId: variant.id, action: 'open_home' },
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.CHECKIN }),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
  });
  rememberUse(recent, 'missed_you', variant.id);
  await AsyncStorage.setItem(
    MISSED_YOU_STATE_KEY,
    JSON.stringify({
      scheduledFor: target.toISOString(),
      variantId: variant.id,
      lastFiredAt: state.lastFiredAt,
    } satisfies MissedYouState),
  );
  return variant.id;
}

// ─── Encouragement (dynamic, after meal logs) ───────────────────

/**
 * Call after a meal is logged (and on foreground). Schedules a one-shot 9pm
 * "that's a real day" note when today has 3+ meals and the streak is 5+.
 * Max once per 3 days.
 */
export async function checkAndScheduleEncouragement(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Count only entries actually logged today — the store's list can be
    // yesterday's if the app sat in the background across midnight.
    const today = new Date().toDateString();
    const mealsToday = useDailyStore
      .getState()
      .entries.filter((e) => new Date(e.logged_at).toDateString() === today).length;
    const streak = useStreakStore.getState().currentStreak;
    if (mealsToday < 3 || streak < 5) return;

    const userId = useAuthStore.getState().user?.id ?? null;
    const prefs = await loadNotificationPrefs(userId);
    if (!prefs.notifications_enabled || !prefs.encouragement_enabled) return;

    const stamp = await AsyncStorage.getItem(ENCOURAGEMENT_STAMP_KEY);
    if (stamp && Date.now() - new Date(stamp).getTime() < DYNAMIC_DEDUP_HOURS * 60 * 60 * 1000) {
      return;
    }

    const now = new Date();
    const target = new Date();
    target.setHours(21, 0, 0, 0);
    const fireNow = target.getTime() <= now.getTime();
    if (fireNow && isWithinQuietHours(prefs, now.getHours(), now.getMinutes())) return;
    if (!fireNow && isWithinQuietHours(prefs, 21, 0)) return;

    const ctx = buildFullContext();
    const recent = await loadRecentVariants();
    const variant = selectVariant(
      VARIANTS_BY_TYPE.encouragement,
      ctx,
      recentIdsFor(recent, 'encouragement'),
    );
    const copy = renderCopy(variant, ctx);

    await Notifications.scheduleNotificationAsync({
      identifier: ENCOURAGEMENT_ID,
      content: {
        title: copy.title,
        body: copy.body,
        data: { type: 'encouragement', variantId: variant.id, action: 'open_home' },
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.CHECKIN }),
      },
      trigger: fireNow
        ? null
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
    });

    rememberUse(recent, 'encouragement', variant.id);
    await saveRecentVariants(recent);
    await AsyncStorage.setItem(
      ENCOURAGEMENT_STAMP_KEY,
      (fireNow ? now : target).toISOString(),
    );
    logHistory('encouragement', variant.id);
    trackEvent('notification_scheduled', { type: 'encouragement', variant_id: variant.id });
  } catch (e) {
    console.warn('Encouragement check failed:', e);
  }
}

// ─── Meal-log attribution ───────────────────────────────────────

/**
 * Call right after a meal is logged: if an enabled meal reminder fired within
 * the previous 30 minutes, credit it with `notification_led_to_log`.
 */
export async function recordMealLogAttribution(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const userId = useAuthStore.getState().user?.id ?? null;
    const prefs = await loadNotificationPrefs(userId);
    if (!prefs.notifications_enabled || !prefs.meal_reminders_enabled) return;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const meals: [PersonalityNotificationType, string][] = [
      ['meal_breakfast', prefs.breakfast_time],
      ['meal_lunch', prefs.lunch_time],
      ['meal_snack', prefs.snack_time],
      ['meal_dinner', prefs.dinner_time],
    ];
    for (const [type, time] of meals) {
      const [h, m] = parseHHMM(time);
      const diff = nowMin - (h * 60 + m);
      if (diff >= 0 && diff <= 30) {
        const recent = await loadRecentVariants();
        trackEvent('notification_led_to_log', {
          type,
          variant_id: latestVariantFor(recent, type),
          minutes_after: diff,
        });
        return;
      }
    }
  } catch {
    // Attribution is best-effort analytics — never block a meal log.
  }
}

// ─── Settings-screen helpers ────────────────────────────────────

/** Immediate preview so the user can check sound/appearance. */
export async function sendTestNotification(): Promise<void> {
  const ctx = buildFullContext();
  const pool: CopyVariant[] = [
    { id: 'test_1', title: 'Testing, testing, {name}', body: "This is how I'll check in. Warm, not naggy." },
    { id: 'test_2', title: 'Hello {name} 👋', body: 'Reminders will look like this. Chai not included.' },
    { id: 'test_3', title: 'All set, {name}', body: "I'll nudge gently at meal times and water breaks." },
  ];
  const variant = pool[Math.floor(Math.random() * pool.length)];
  const copy = renderCopy(variant, ctx);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      data: { type: 'test', action: 'open_home' },
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.CHECKIN }),
    },
    trigger: null,
  });
}

/** Cancel every personality notification, including the event-armed ones
 * (encouragement, streak-at-risk) the reschedule pass leaves alone. For
 * sign-out: user A's reminders must never fire in user B's session. */
export async function cancelPersonalityNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    const type = notif.content.data?.type;
    if (
      typeof type === 'string' &&
      (MANAGED_TYPES.has(type) || type === 'encouragement' || type === 'streak_at_risk')
    ) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
  await clearMissedYouSchedule();
}
