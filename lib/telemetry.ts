import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

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
  | 'settings_viewed';

interface QueuedEvent {
  event_name: AnalyticsEventName;
  user_id: string | null;
  occurred_at_local: string;
  occurred_at_utc: string;
  properties: Record<string, unknown>;
  app_version: string | null;
  platform: string;
}

const STORAGE_KEY = 'nutrisnap.analytics.queue.v1';
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
  const event: QueuedEvent = {
    event_name: eventName,
    user_id: data.user?.id ?? null,
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

  const { error } = await supabase.from('events').insert(queue);
  if (!error) {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}
