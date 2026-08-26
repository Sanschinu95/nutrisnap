/**
 * Notification preferences store — reactive wrapper over
 * lib/notificationPrefs persistence. Every change is optimistic, persisted
 * (Supabase for signed-in users, AsyncStorage for guests), and triggers a
 * debounced reschedule so the OS schedule always matches what the settings
 * screen shows — without thrashing while a picker wheel is spinning.
 */

import { create } from 'zustand';
import {
  clearLocalNotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPreferences,
} from '@/lib/notificationPrefs';
import { rescheduleAllPersonalityNotifications } from '@/lib/notificationScheduler';

interface NotificationPrefsState {
  prefs: NotificationPreferences;
  isLoaded: boolean;
  currentUserId: string | null;
}

interface NotificationPrefsActions {
  loadPrefs: (userId: string | null) => Promise<void>;
  updatePrefs: (updates: Partial<NotificationPreferences>) => void;
  resetToDefaults: () => void;
  reset: () => void;
}

const RESCHEDULE_DEBOUNCE_MS = 800;
let rescheduleTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useNotificationPrefsStore = create<
  NotificationPrefsState & NotificationPrefsActions
>((set, get) => ({
  prefs: { ...DEFAULT_NOTIFICATION_PREFS },
  isLoaded: false,
  currentUserId: null,

  loadPrefs: async (userId) => {
    const prefs = await loadNotificationPrefs(userId);
    set({ prefs, isLoaded: true, currentUserId: userId });
  },

  updatePrefs: (updates) => {
    const { prefs, currentUserId } = get();
    const next = { ...prefs, ...updates };
    set({ prefs: next });

    // Debounce persistence + reschedule together: picker wheels emit a burst
    // of updates; only the settled value should hit the network and the OS.
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      saveNotificationPrefs(currentUserId, get().prefs);
    }, RESCHEDULE_DEBOUNCE_MS);

    if (rescheduleTimer) clearTimeout(rescheduleTimer);
    rescheduleTimer = setTimeout(() => {
      rescheduleAllPersonalityNotifications(get().prefs);
    }, RESCHEDULE_DEBOUNCE_MS);
  },

  resetToDefaults: () => {
    get().updatePrefs({ ...DEFAULT_NOTIFICATION_PREFS });
  },

  reset: () => {
    if (rescheduleTimer) clearTimeout(rescheduleTimer);
    if (persistTimer) clearTimeout(persistTimer);
    rescheduleTimer = null;
    persistTimer = null;
    clearLocalNotificationPrefs();
    set({
      prefs: { ...DEFAULT_NOTIFICATION_PREFS },
      isLoaded: false,
      currentUserId: null,
    });
  },
}));
