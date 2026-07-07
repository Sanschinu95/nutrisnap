import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { logSupabaseError } from './supabaseError';

export type AnalyticsEventName =
  | 'scan_started'
  | 'scan_completed'
  | 'scan_edited'
  | 'scan_feedback'
  | 'route_viewed'
  | 'route_node_expanded'
  | 'hydration_logged'
  | 'notification_received'
  | 'notification_opened'
  | 'streak_grace_used'
  | 'vacation_mode_toggled'
  | 'progress_tab_viewed'
  | 'settings_viewed'
  | 'coach_opened'
  | 'coach_insight_tapped'
  | 'coach_suggestion_tapped'
  | 'coach_custom_prompt'
  | 'coach_action_pinned'
  | 'coach_pinned_opened'
  | 'coach_pinned_dismissed'
  | 'coach_limit_reached'
  | 'coach_premium_viewed'
  | 'coach_premium_tapped'
  | 'coach_conversation_resumed'
  | 'coach_conversation_dismissed'
  | 'manual_entry_ai_fill'
  | 'manual_entry_db_fill'
  | 'feedback_submitted'
  | 'treat_day_unlocked'
  | 'treat_day_celebration_dismissed'
  | 'treat_day_activated'
  | 'treat_day_suggestion_selected'
  | 'treat_day_expired_unused'
  | 'streak_milestone_reached'
  | 'streak_milestone_shared'
  | 'streak_milestone_dismissed'
  | 'streak_reset'
  | 'friend_code_shared'
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'friend_request_declined'
  | 'friend_removed'
  | 'leaderboard_viewed'
  | 'ghost_mode_enabled'
  | 'ghost_mode_disabled'
  | 'referral_link_shared'
  | 'referral_reward_earned';

interface QueuedEvent {
  event_name: AnalyticsEventName;
  user_id: string | null;
  occurred_at_local: string;
  occurred_at_utc: string;
  properties: Record<string, unknown>;
  app_version: string | null;
  platform: string;
}

const STORAGE_KEY = 'nyurix.analytics.queue.v1';
const FLUSH_THRESHOLD = 8;

function toLocalTimestamp(date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

async function readQueue(): Promise<QueuedEvent[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedEvent[];
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

async function writeQueue(events: QueuedEvent[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export async function trackEvent(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const now = new Date();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;

  // RLS on `events` rejects rows with null user_id (`with check (auth.uid() = user_id)`).
  // Drop anon events client-side so they don't poison the next flush.
  if (!userId) return;

  const event: QueuedEvent = {
    event_name: eventName,
    user_id: userId,
    occurred_at_local: toLocalTimestamp(now),
    occurred_at_utc: now.toISOString(),
    properties,
    app_version: Constants.expoConfig?.version ?? null,
    platform: Platform.OS,
  };

  const queue = [...await readQueue(), event];
  await writeQueue(queue);

  if (queue.length >= FLUSH_THRESHOLD) {
    await flushEvents();
  }
}

export async function flushEvents(): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;

  // Belt-and-suspenders: never send rows the RLS policy will reject.
  const valid = queue.filter((e) => !!e.user_id);
  const dropped = queue.length - valid.length;
  if (dropped > 0) {
    console.warn(`[Supabase] dropping ${dropped} anon events from flush queue`);
  }
  if (valid.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }

  const { error } = await supabase.from('events').insert(valid);
  if (error) {
    logSupabaseError('events.insert', error);
    // Drop the queue anyway — re-queueing the same rejected rows creates an
    // unbounded retry loop that was the root cause of the 20% failure rate.
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}
