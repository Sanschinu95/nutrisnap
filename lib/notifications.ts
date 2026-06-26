/**
 * Notification service for NutriSnap
 * Handles expo-notifications initialization, scheduling, and archetype-based messaging
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ArchetypeKey } from '@/types/archetype';
import { STREAK_MILESTONES } from '@/constants/archetypeProgress';
import { trackEvent } from './telemetry';

// ─── Notification Channel IDs ───────────────────────────────────
export const NOTIFICATION_CHANNELS = {
  MEAL_REMINDER: 'meal-reminder',
  WATER_REMINDER: 'water-reminder',
  GOAL_HIT: 'goal-hit',
  STREAK: 'streak',
  PROGRESS: 'progress',
} as const;

export const NOTIFICATION_CATEGORIES = {
  HYDRATION_QUICK_ADD: 'hydration-quick-add',
} as const;

export const HYDRATION_ACTIONS = {
  ADD_250: 'hydration-add-250',
  ADD_500: 'hydration-add-500',
  OTHER: 'hydration-other',
} as const;

// ─── Archetype Notification Messages ────────────────────────────
interface ArchetypeMessages {
  meal: string;
  streak: string;
  goal: string;
  midday: string;
  almostThere: string;
  nearComplete: string;
}

export const ARCHETYPE_MESSAGES: Record<ArchetypeKey, ArchetypeMessages> = {
  wolf: {
    meal: "Time to hunt 🐺 Your next meal fuels the Wolf.",
    streak: "The Wolf pack respects consistency. Keep the streak alive.",
    goal: "Goal achieved. The Wolf hunts with precision. 🎯",
    midday: "You haven't logged yet — the Wolf doesn't skip meals.",
    almostThere: "You're 70% there. Stay locked in, hunter.",
    nearComplete: "One meal away from hitting goal. Finish the hunt.",
  },
  bear: {
    meal: "Feed the Bear 🐻 Balanced meals build raw power.",
    streak: "Bears are consistent. Your streak proves your strength.",
    goal: "Goal smashed. That's Bear-level discipline. 💪",
    midday: "No logs yet today — Bears don't hibernate on nutrition.",
    almostThere: "You're cruising at 70%. Keep fueling the engine.",
    nearComplete: "Almost there — one more meal seals the deal.",
  },
  lion: {
    meal: "The King eats 🦁 Command your nutrition today.",
    streak: "The pride follows your lead. Streak secured.",
    goal: "Goal achieved. A Lion never wavers. 👑",
    midday: "No logs yet — a Lion leads by example.",
    almostThere: "70% done. Maintain your royal composure.",
    nearComplete: "One meal from the crown. Finish strong.",
  },
  deer: {
    meal: "Time for clean fuel 🦌 Nourish the runner.",
    streak: "Keep running, keep logging. Your streak is your path.",
    goal: "Goal met. Graceful and consistent. 🌿",
    midday: "You haven't logged yet — stay on the trail.",
    almostThere: "You're 70% there. Keep your pace steady.",
    nearComplete: "Almost at the finish line. One more meal.",
  },
  tigress: {
    meal: "Fuel the fire 🐯 The Tigress needs protein.",
    streak: "Fierce and consistent — your streak is unbreakable.",
    goal: "Goal crushed. That's pure Tigress energy. 🔥",
    midday: "No logs yet — the Tigress never sleeps on nutrition.",
    almostThere: "70% there. Stay fierce, stay focused.",
    nearComplete: "One meal away. Finish with ferocity.",
  },
  phoenix: {
    meal: "Rise and fuel 🔥 Every meal is transformation.",
    streak: "The flame burns brighter with every streak day.",
    goal: "Goal achieved. You are transforming. ✨",
    midday: "No logs yet — don't let the flame die today.",
    almostThere: "70% there. The fire is building.",
    nearComplete: "One meal from rebirth. Keep going.",
  },
  doe: {
    meal: "Mindful nourishment 🦌 Feed your graceful soul.",
    streak: "Consistency is grace in action. Beautiful streak.",
    goal: "Goal met. Graceful and intentional. 🌸",
    midday: "No logs yet — nourish yourself mindfully today.",
    almostThere: "70% there. Keep flowing naturally.",
    nearComplete: "Almost complete. One gentle step left.",
  },
  swan: {
    meal: "Nourish your elegance 🦢 The Swan glides on clean fuel.",
    streak: "Swans never lose their grace. Your streak is beautiful.",
    goal: "Goal achieved. Elegant and disciplined. 🦢",
    midday: "No logs yet — the Swan stays poised even at midday.",
    almostThere: "70% there. Glide through the rest with grace.",
    nearComplete: "One meal from perfection. Finish gracefully.",
  },
};

// ─── Default messages (no archetype selected) ───────────────────
const DEFAULT_MESSAGES: ArchetypeMessages = {
  meal: "Time to eat! Don't forget to log your meal.",
  streak: "Your streak is going strong. Keep it up!",
  goal: "Daily goal achieved. Great job! 🎉",
  midday: "You haven't logged yet — stay on track.",
  almostThere: "You're almost there. Stay consistent.",
  nearComplete: "One meal away from hitting your goal.",
};

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
 * @param archetype - User's archetype for personalized message
 */
export async function scheduleMealReminder(
  hour: number,
  minute: number,
  archetype?: ArchetypeKey | null
): Promise<string> {
  // Cancel existing meal reminders first
  await cancelMealReminders();

  const messages = archetype ? ARCHETYPE_MESSAGES[archetype] : DEFAULT_MESSAGES;

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
 * Fire a notification when user hits their daily calorie goal.
 */
export async function sendGoalHitNotification(archetype?: ArchetypeKey | null): Promise<void> {
  const messages = archetype ? ARCHETYPE_MESSAGES[archetype] : DEFAULT_MESSAGES;

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
  archetype?: ArchetypeKey | null
): Promise<void> {
  // Only fire for milestone days
  if (!STREAK_MILESTONES.includes(streakDays as typeof STREAK_MILESTONES[number])) return;

  const messages = archetype ? ARCHETYPE_MESSAGES[archetype] : DEFAULT_MESSAGES;

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
  archetype?: ArchetypeKey | null,
  alreadyNotified?: { midday?: boolean; almostThere?: boolean; nearComplete?: boolean }
): Promise<{ midday?: boolean; almostThere?: boolean; nearComplete?: boolean }> {
  if (goalCalories <= 0) return {};

  const messages = archetype ? ARCHETYPE_MESSAGES[archetype] : DEFAULT_MESSAGES;
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
    trackEvent('notification_opened', {
      type: response.notification.request.content.data?.type ?? 'unknown',
      actionIdentifier: response.actionIdentifier,
    });
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
