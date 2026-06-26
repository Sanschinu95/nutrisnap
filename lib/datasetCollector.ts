/**
 * Fire-and-forget dataset collection for ML training.
 *
 * Completely decoupled from the main meal logging flow:
 *   - Different table (training_data, not meals/food_items)
 *   - No shared transactions, no FKs, no shared error handling
 *   - All values are COPIED in at call time; never references back to meals
 *   - Imports nothing from stores; only depends on the supabase client
 *
 * Every failure is silently swallowed. If this module breaks, the rest of the
 * app continues to work exactly as before.
 */

import { supabase } from './supabase';

interface AIPrediction {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  raw_response?: unknown;
}

interface UserCorrection {
  food_name?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

type FeedbackType = 'confirmed' | 'corrected' | 'rejected' | 'none';

/**
 * Best-effort device locale via the Hermes-native Intl API.
 * Avoids adding expo-localization as a dependency.
 */
function getDeviceLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? null;
  } catch {
    return null;
  }
}

export async function collectTrainingData(params: {
  imageUrl: string;
  aiPrediction: AIPrediction | null;
  userCorrection: UserCorrection | null;
  feedbackType: FeedbackType;
  source: 'scan' | 'manual';
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('training_data').insert({
      image_url: params.imageUrl,

      ai_food_name: params.aiPrediction?.food_name ?? null,
      ai_calories: params.aiPrediction?.calories ?? null,
      ai_protein_g: params.aiPrediction?.protein_g ?? null,
      ai_carbs_g: params.aiPrediction?.carbs_g ?? null,
      ai_fat_g: params.aiPrediction?.fat_g ?? null,
      ai_raw_response: params.aiPrediction?.raw_response ?? null,

      user_food_name: params.userCorrection?.food_name ?? null,
      user_calories: params.userCorrection?.calories ?? null,
      user_protein_g: params.userCorrection?.protein_g ?? null,
      user_carbs_g: params.userCorrection?.carbs_g ?? null,
      user_fat_g: params.userCorrection?.fat_g ?? null,

      feedback_type: params.feedbackType,
      source: params.source,
      device_locale: getDeviceLocale(),
      contributor_id: user?.id ?? null,
    });
  } catch {
    // Silently swallow. Dataset collection must never affect the app.
  }
}
