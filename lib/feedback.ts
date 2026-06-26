/**
 * Daily feedback system — prompts for rating once per day,
 * never again after the user submits a rating.
 *
 * Checks:
 *  1. Permanent flag (local + Supabase profile) — once submitted, never ask again.
 *  2. Daily date key — don't re-ask after a dismiss the same day.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuthStore } from '@/stores/auth.store';

const FEEDBACK_DATE_KEY = 'nutrisnap_last_feedback_date';
const FEEDBACK_PERMANENT_KEY = 'nutrisnap_feedback_submitted';

export interface FeedbackPayload {
  rating: number; // 1-5
  comment?: string;
  date: string;
}

/**
 * Check whether the daily feedback modal should be shown.
 * Returns false if:
 *  - User has permanently submitted feedback (local flag or Supabase profile)
 *  - User has already dismissed or submitted today
 */
export async function shouldShowFeedback(): Promise<boolean> {
  try {
    // 1. Check permanent local flag (fastest path)
    const permanentFlag = await AsyncStorage.getItem(FEEDBACK_PERMANENT_KEY);
    if (permanentFlag === 'true') return false;

    // 2. Check Supabase profile flag (cross-device persistence)
    const user = useAuthStore.getState().user;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('feedback_submitted')
        .eq('id', user.id)
        .single();
      if (profile?.feedback_submitted) {
        // Sync the local flag so we skip the network call next time
        await AsyncStorage.setItem(FEEDBACK_PERMANENT_KEY, 'true');
        return false;
      }
    }

    // 3. Check daily date key — don't re-ask same day
    const today = new Date().toISOString().split('T')[0];
    const lastDate = await AsyncStorage.getItem(FEEDBACK_DATE_KEY);
    return lastDate !== today;
  } catch {
    return false;
  }
}

/**
 * Save feedback locally (AsyncStorage) and to Supabase.
 * Sets the permanent "never show again" flag.
 */
export async function saveFeedback(
  rating: number,
  comment?: string,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Mark as permanently done
  await AsyncStorage.setItem(FEEDBACK_DATE_KEY, today);
  await AsyncStorage.setItem(FEEDBACK_PERMANENT_KEY, 'true');

  // Persist to Supabase if authenticated
  try {
    const user = useAuthStore.getState().user;
    if (user) {
      // Save the feedback entry
      await supabase.from('app_feedback').insert({
        user_id: user.id,
        rating,
        comment: comment || null,
        feedback_date: today,
        created_at: new Date().toISOString(),
      });

      // Set the permanent flag on the profile
      await supabase
        .from('profiles')
        .update({ feedback_submitted: true })
        .eq('id', user.id);
    }
  } catch (error) {
    // Supabase insert may fail if table doesn't exist — that's fine,
    // feedback is already saved locally and the permanent flag is set.
    console.warn('Feedback save to Supabase failed:', error);
  }
}

/**
 * Dismiss feedback for today without saving a rating.
 * Does NOT set the permanent flag — will re-ask on a different day.
 */
export async function dismissFeedback(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await AsyncStorage.setItem(FEEDBACK_DATE_KEY, today);
}
