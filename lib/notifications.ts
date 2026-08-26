/**
 * Notification service for Nyurix
 * Handles expo-notifications initialization, scheduling, and reminder messaging
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { trackEvent } from './telemetry';
import {
  loadRecentVariants,
  recentIdsFor,
  rememberUse,
  renderCopy,
  saveRecentVariants,
  selectVariant,
  STREAK_AT_RISK_VARIANTS,
} from './notificationCopy';
import { isWithinQuietHours, loadNotificationPrefs } from './notificationPrefs';
import { useUserStore } from '@/stores/user.store';

// ─── Notification Channel IDs ───────────────────────────────────
export const NOTIFICATION_CHANNELS = {
  MEAL_REMINDER: 'meal-reminder',
  WATER_REMINDER: 'water-reminder',
  GOAL_HIT: 'goal-hit',
  STREAK: 'streak',
  PROGRESS: 'progress',
  COACH_WEEKLY: 'coach-weekly',
  SLEEP_REMINDER: 'sleep-reminder',
  CHECKIN: 'checkin',
} as const;

export const NOTIFICATION_CATEGORIES = {
  HYDRATION_QUICK_ADD: 'hydration-quick-add',
} as const;

export const HYDRATION_ACTIONS = {
  ADD_250: 'hydration-add-250',
  ADD_500: 'hydration-add-500',
  OTHER: 'hydration-other',
} as const;

// ─── Reminder Messages ──────────────────────────────────────────
interface ReminderMessages {
  meal: string;
  streak: string;
  goal: string;
  midday: string;
  almostThere: string;
  nearComplete: string;
}

// Warm voice, never corporate: these legacy strings are kept aligned with the
// personality copy in notificationCopy.ts (concern, not pressure).
const DEFAULT_MESSAGES: ReminderMessages = {
  meal: 'Whatever you are eating, snap it before the first bite.',
  streak: 'Your streak is going strong. Keep it up!',
  goal: 'Daily goal achieved. Great job! 🎉',
  midday: "Quiet morning? Whenever you eat, I'm here to log it.",
  almostThere: "Good rhythm today. You're getting there.",
  nearComplete: 'One meal away from your goal. Nicely done.',
};

/** Streak day-counts that trigger a milestone notification. */
const STREAK_MILESTONES = [7, 14, 30, 60, 90] as const;

// ─── Initialize Notifications ───────────────────────────────────
/**
 * Configure notification handler and request permissions.
 * Call this once at app startup.
 */
export async function initializeNotifications(): Promise<boolean> {
  // Set how notifications are handled when app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldFlashScreen: false,
      shouldShowList: true,
    }),
  });

  // Set up Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.MEAL_REMINDER, {
      name: 'Meal Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E8703A',
    });

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.WATER_REMINDER, {
      name: 'Water Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150],
      lightColor: '#4FC3F7',
    });

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.GOAL_HIT, {
      name: 'Goal Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#5D7A3E',
    });

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.STREAK, {
      name: 'Streak Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#FFD700',
    });

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.PROGRESS, {
      name: 'Progress Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#E8703A',
    });

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.COACH_WEEKLY, {
      name: 'Coach Weekly Review',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#3D8BFF',
    });

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.SLEEP_REMINDER, {
      name: 'Sleep Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150],
      lightColor: '#8B5CF6',
    });

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.CHECKIN, {
      name: 'Check-ins & Encouragement',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#4CAF50',
    });
  }

  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.HYDRATION_QUICK_ADD, [
    {
      identifier: HYDRATION_ACTIONS.ADD_250,
      buttonTitle: '+250ml',
      options: { opensAppToForeground: false },
    },
    {
      identifier: HYDRATION_ACTIONS.ADD_500,
      buttonTitle: '+500ml',
      options: { opensAppToForeground: false },
    },
    {
      identifier: HYDRATION_ACTIONS.OTHER,
      buttonTitle: 'Other',
      options: { opensAppToForeground: true },
    },
  ]);

  // NOTE: deliberately does NOT request permission. The OS prompt is shown
  // from the notification-intro screen after onboarding, once the user has
  // seen the app's value — never cold on first launch.
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Show the OS permission prompt. Call from the notification-intro screen (or
 * settings), never at cold start.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Immediate / Event-based Notifications ──────────────────────

/**
 * Evening streak-protection reminder with warm rotating copy: "Your {n}-day
 * streak, {name} — log anything before bed." Scheduled for 8pm; cancels any
 * previously-scheduled one first. Skips streaks under 3 days (not worth
 * protecting yet), quiet hours, and disabled prefs.
 */
const STREAK_AT_RISK_ID = 'streak-at-risk-evening';
const STREAK_AT_RISK_HOUR = 20;

export async function scheduleStreakAtRiskReminder(streakCount: number): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_AT_RISK_ID).catch(() => {});
    if (streakCount < 3) return;

    const profile = useUserStore.getState().profile;
    const prefs = await loadNotificationPrefs(profile?.id ?? null);
    if (!prefs.notifications_enabled || !prefs.streak_reminders_enabled) return;
    if (isWithinQuietHours(prefs, STREAK_AT_RISK_HOUR, 0)) return;

    const now = new Date();
    const target = new Date();
    target.setHours(STREAK_AT_RISK_HOUR, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);

    const context = { name: profile?.name ?? 'friend', streak: streakCount };
    const recent = await loadRecentVariants();
    const variant = selectVariant(
      STREAK_AT_RISK_VARIANTS,
      context,
      recentIdsFor(recent, 'streak_at_risk'),
    );
    const copy = renderCopy(variant, context);
    rememberUse(recent, 'streak_at_risk', variant.id);
    await saveRecentVariants(recent);

    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_AT_RISK_ID,
      content: {
        title: copy.title,
        body: copy.body,
        data: { type: 'streak_at_risk', variantId: variant.id, action: 'open_scan' },
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.STREAK }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target,
      },
    });
  } catch (e) {
    console.warn('Streak reminder scheduling failed:', e);
  }
}

export async function cancelStreakAtRiskReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_AT_RISK_ID);
  } catch {
    // Already canceled / never scheduled — ignore.
  }
}

/**
 * Morning "one more day" notification when the next milestone is exactly one
 * day away. Caller dedupes per milestone.
 */
export async function sendMilestoneApproachingNotification(milestoneName: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'One more day',
        body: `Log today and you hit ${milestoneName}.`,
        data: { type: 'milestone_approaching', name: milestoneName },
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.STREAK }),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Milestone notification failed:', e);
  }
}

export async function sendGraceDayUsedNotification(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Grace day used',
        body: "Yesterday slipped by, but your streak's still alive. Log something today.",
        data: { type: 'grace_day_used' },
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.STREAK }),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Grace day notification failed:', e);
  }
}

/**
 * Fire a notification when the user unlocks a treat day. Caller is
 * responsible for respecting the per-user `treat_day_notifications_enabled`
 * preference.
 */
export async function sendTreatDayUnlockNotification(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "You've earned a treat day",
        body: '5 days of consistency. Open Nyurix to see your suggestions.',
        data: { type: 'treat_day_unlocked' },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.GOAL_HIT,
        }),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Treat day notification failed:', e);
  }
}

/**
 * Fire a notification when user hits their daily calorie goal.
 */
export async function sendGoalHitNotification(): Promise<void> {
  const messages = DEFAULT_MESSAGES;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🎯 Goal Achieved!',
      body: messages.goal,
      data: { type: 'goal_hit' },
      ...(Platform.OS === 'android' && {
        channelId: NOTIFICATION_CHANNELS.GOAL_HIT,
      }),
    },
    trigger: null, // immediate
  });
}

/**
 * Fire a streak milestone notification.
 */
export async function sendStreakNotification(
  streakDays: number,
): Promise<void> {
  // Only fire for milestone days
  if (!STREAK_MILESTONES.includes(streakDays as typeof STREAK_MILESTONES[number])) return;

  const messages = DEFAULT_MESSAGES;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔥 ${streakDays}-Day Streak!`,
      body: messages.streak,
      data: { type: 'streak', days: streakDays },
      ...(Platform.OS === 'android' && {
        channelId: NOTIFICATION_CHANNELS.STREAK,
      }),
    },
    trigger: null,
  });
}

// ─── Dynamic Progress Notifications ─────────────────────────────

/**
 * Check calorie progress and send appropriate progress notification.
 * Call this after food entries are added or summary is updated.
 */
export async function checkAndSendProgressNotification(
  currentCalories: number,
  goalCalories: number,
  alreadyNotified?: { midday?: boolean; almostThere?: boolean; nearComplete?: boolean }
): Promise<{ midday?: boolean; almostThere?: boolean; nearComplete?: boolean }> {
  if (goalCalories <= 0) return {};

  const messages = DEFAULT_MESSAGES;
  const progress = currentCalories / goalCalories;
  const hour = new Date().getHours();
  const fired: { midday?: boolean; almostThere?: boolean; nearComplete?: boolean } = {};

  // Midday check: no logs by noon
  if (hour >= 12 && currentCalories === 0 && !alreadyNotified?.midday) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📋 No Logs Yet',
        body: messages.midday,
        data: { type: 'progress_midday' },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.PROGRESS,
        }),
      },
      trigger: null,
    });
    fired.midday = true;
  }

  // 60-80% progress
  if (progress >= 0.6 && progress < 0.8 && !alreadyNotified?.almostThere) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Making Progress',
        body: messages.almostThere.replace('70%', `${Math.round(progress * 100)}%`),
        data: { type: 'progress_almost' },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.PROGRESS,
        }),
      },
      trigger: null,
    });
    fired.almostThere = true;
  }

  // 80-99% progress
  if (progress >= 0.8 && progress < 1.0 && !alreadyNotified?.nearComplete) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏁 Almost There',
        body: messages.nearComplete,
        data: { type: 'progress_near' },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.PROGRESS,
        }),
      },
      trigger: null,
    });
    fired.nearComplete = true;
  }

  return fired;
}

// ─── Cancel Helpers ─────────────────────────────────────────────

// ─── Coach Weekly Review ────────────────────────────────────────
/**
 * Schedule a weekly notification every Sunday at 8 PM local time prompting
 * the user to review their week with the coach. Idempotent — cancels any
 * existing weekly review before scheduling.
 */
export async function scheduleCoachWeeklyReview(): Promise<string> {
  await cancelCoachWeeklyReview();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your weekly nutrition review is ready',
      body: 'Tap to see how your week went and what to focus on next.',
      data: { type: 'coach_weekly_review' },
      ...(Platform.OS === 'android' && {
        channelId: NOTIFICATION_CHANNELS.COACH_WEEKLY,
      }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // expo-notifications: 1 = Sunday, 7 = Saturday
      hour: 20,
      minute: 0,
    },
  });
}

export async function cancelCoachWeeklyReview(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === 'coach_weekly_review') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Listeners: telemetry + tap routing + quick actions ─────────

function navigate(path: string): void {
  // Defer a tick: a tap response can arrive during cold start before the
  // router is mounted, and an immediate push would throw.
  setTimeout(() => {
    try {
      router.push(path as never);
    } catch (e) {
      console.warn('Notification navigation failed:', e);
    }
  }, 0);
}

/**
 * Registers the app-wide notification listeners: delivery/tap telemetry,
 * hydration quick-add actions, interaction history, and tap → deep-link
 * routing. Call once from the root layout; returns an unsubscribe.
 */
export function registerNotificationListeners(): () => void {
  const received = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data ?? {};
    trackEvent('notification_received', {
      type: data.type ?? 'unknown',
      variant_id: data.variantId ?? null,
    });
  });

  const opened = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    const type = typeof data.type === 'string' ? data.type : 'unknown';
    const variantId = typeof data.variantId === 'string' ? data.variantId : null;
    const actionId = response.actionIdentifier;

    trackEvent('notification_opened', {
      type,
      variant_id: variantId,
      actionIdentifier: actionId,
    });

    // Hydration quick-add buttons log water without opening the app.
    // (Dynamic imports here dodge the notifications ⇄ store/scheduler cycle.)
    if (actionId === HYDRATION_ACTIONS.ADD_250 || actionId === HYDRATION_ACTIONS.ADD_500) {
      const ml = actionId === HYDRATION_ACTIONS.ADD_250 ? 250 : 500;
      import('@/stores/daily.store')
        .then((m) => m.useDailyStore.getState().addWater(ml))
        .catch((e) => console.warn('Quick-add water failed:', e));
      import('./notificationScheduler')
        .then((m) => m.recordNotificationInteraction(type, variantId, 'action_taken'))
        .catch(() => {});
      return;
    }

    import('./notificationScheduler')
      .then((m) => m.recordNotificationInteraction(type, variantId, 'opened'))
      .catch(() => {});

    // Route to the right screen. Personality notifications carry an explicit
    // action; legacy types fall back to sensible destinations.
    const action = typeof data.action === 'string' ? data.action : null;
    switch (action) {
      case 'open_scan': navigate('/(tabs)/camera'); return;
      case 'open_hydration': navigate('/(tabs)/home?focus=hydration'); return;
      case 'open_sleep_confirmation': navigate('/(tabs)/home?focus=sleep'); return;
      case 'open_home': navigate('/(tabs)/home'); return;
    }
    if (type === 'coach_weekly_review') navigate('/coach');
    else if (type === 'streak_at_risk' || type === 'meal_reminder') navigate('/(tabs)/camera');
    else if (type !== 'test') navigate('/(tabs)/home');
  });

  return () => {
    received.remove();
    opened.remove();
  };
}

// ─── Permission Check ───────────────────────────────────────────

export async function getNotificationPermissionStatus(): Promise<string> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}
