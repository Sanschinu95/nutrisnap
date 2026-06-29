/**
 * Bug reports / feature requests / contact support — submitted to the
 * `user_feedback` table. Distinct from `lib/feedback.ts`, which handles
 * the daily NPS-style prompt.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Lazy require: lets the app boot on a dev build that predates expo-device.
function loadDeviceModel(): string | null {
  try {
    const Device = require('expo-device') as typeof import('expo-device');
    return Device.modelName ?? null;
  } catch {
    return null;
  }
}

export type UserFeedbackType = 'bug_report' | 'feature_request' | 'contact_support';

export interface UserFeedbackInput {
  userId: string;
  type: UserFeedbackType;
  title: string;
  description: string;
  screenshotUrl?: string | null;
}

export async function submitUserFeedback(input: UserFeedbackInput): Promise<void> {
  const deviceInfo = {
    os: Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: Constants.expoConfig?.version ?? null,
    deviceModel: loadDeviceModel(),
  };

  const { error } = await supabase.from('user_feedback').insert({
    user_id: input.userId,
    feedback_type: input.type,
    title: input.title.trim() || null,
    description: input.description.trim(),
    device_info: deviceInfo,
    screenshot_url: input.screenshotUrl ?? null,
  });

  if (error) throw error;
}
