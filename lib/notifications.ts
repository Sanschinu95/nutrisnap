/**
 * Notification service for Nyurix
 * Handles expo-notifications initialization, scheduling, and reminder messaging
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { trackEvent } from './telemetry';

// ─── Notification Channel IDs ───────────────────────────────────
export const NOTIFICATION_CHANNELS = {
  MEAL_REMINDER: 'meal-reminder',
  WATER_REMINDER: 'water-reminder',
  GOAL_HIT: 'goal-hit',
  STREAK: 'streak',
  PROGRESS: 'progress',
  COACH_WEEKLY: 'coach-weekly',
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

const DEFAULT_MESSAGES: ReminderMessages = {
  meal: "Time to eat! Don't forget to log your meal.",
  streak: "Your streak is going strong. Keep it up!",
  goal: "Daily goal achieved. Great job! 🎉",
  midday: "You haven't logged yet — stay on track.",
  almostThere: "You're almost there. Stay consistent.",
  nearComplete: "One meal away from hitting your goal.",
};

/** Streak day-counts that trigger a milestone notification. */
const STREAK_MILESTONES = [7, 14, 30, 60, 90] as const;

// ─── Water Reminder Config ──────────────────────────────────────
const WATER_REMINDER_START_HOUR = 8;
const WATER_REMINDER_END_HOUR = 20;
const WATER_REMINDER_INTERVAL_HOURS = 2;

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

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

// ─── Schedule Meal Reminder ─────────────────────────────────────
/**
 * Schedule a daily repeating meal reminder at user-selected time.
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 */
export async function scheduleMealReminder(
  hour: number,
  minute: number,
): Promise<string> {
  // Cancel existing meal reminders first
  await cancelMealReminders();

  const messages = DEFAULT_MESSAGES;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🍽️ Meal Time',
      body: messages.meal,
      data: { type: 'meal_reminder' },
      ...(Platform.OS === 'android' && {
        channelId: NOTIFICATION_CHANNELS.MEAL_REMINDER,
      }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  return id;
}

// ─── Schedule Water Reminders ───────────────────────────────────
/**
 * Schedule water reminders every 2 hours from 8am to 8pm.
 */
export async function scheduleWaterReminders(): Promise<string[]> {
  await cancelWaterReminders();

  const ids: string[] = [];

  for (
    let hour = WATER_REMINDER_START_HOUR;
    hour <= WATER_REMINDER_END_HOUR;
    hour += WATER_REMINDER_INTERVAL_HOURS
  ) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💧 Water Reminder',
        body: `Stay hydrated! Drink a glass of water.`,
        categoryIdentifier: NOTIFICATION_CATEGORIES.HYDRATION_QUICK_ADD,
        data: { type: 'water_reminder', hour },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.WATER_REMINDER,
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
    ids.push(id);
  }

  return ids;
}

// ─── Immediate / Event-based Notifications ──────────────────────

/**
 * Local 6pm reminder: "Your N-day streak. Log something to keep it alive."
 * Cancels any previously-scheduled streak reminder before scheduling the
 * next one. Skip when streak is 0 or already logged today.
 */
const STREAK_AT_RISK_ID = 'streak-at-risk-6pm';

export async function scheduleStreakAtRiskReminder(streakCount: number): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_AT_RISK_ID).catch(() => {});
    if (streakCount < 3) return;
    const now = new Date();
    const target = new Date();
    target.setHours(18, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_AT_RISK_ID,
      content: {
        title: `Your ${streakCount}-day streak`,
        body: 'Log something to keep it alive. Even a snack counts.',
        data: { type: 'streak_at_risk' },
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

export async function cancelMealReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === 'meal_reminder') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

export async function cancelWaterReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === 'water_reminder') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function registerNotificationTelemetryListeners(): () => void {
  const received = Notifications.addNotificationReceivedListener((notification) => {
    trackEvent('notification_received', {
      type: notification.request.content.data?.type ?? 'unknown',
    });
  });
  const opened = Notifications.addNotificationResponseReceivedListener((response) => {
    const type = response.notification.request.content.data?.type ?? 'unknown';
    trackEvent('notification_opened', {
      type,
      actionIdentifier: response.actionIdentifier,
    });
    if (type === 'coach_weekly_review') {
      router.push('/coach' as any);
    }
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
