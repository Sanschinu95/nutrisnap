/**
 * Food-image analysis. Now proxied through the `scan-analyze` Supabase
 * Edge Function so the 6 Groq scan keys stay server-side. See
 * supabase/functions/scan-analyze/index.ts.
 *
 * Client owns:
 *   - Passing a Cloudinary URL (preferred) or base64 fallback
 *   - JSON parsing + shape validation on the returned model content
 *
 * Client does NOT own:
 *   - The Groq keys
 *   - The system prompt (server-side so prompt tweaks don't need an app release)
 */

import { supabase } from './supabase';
import type { NutritionEntry, GroqErrorResponse } from '@/types/nutrition';

/** Image data passed directly from camera / image picker */
export interface ImageData {
  base64: string;
  mimeType?: string; // defaults to image/jpeg
}

function parseAIResponse(text: string): NutritionEntry | GroqErrorResponse {
  let cleanText = text.trim();
  if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
  else if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
  if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
  cleanText = cleanText.trim();

  try {
    const parsed = JSON.parse(cleanText);
    if ('error' in parsed) return parsed as GroqErrorResponse;
    if (!parsed.meal_name || !Array.isArray(parsed.food_items)) {
      return { error: 'analysis_failed', message: 'Invalid response structure' };
    }
    return parsed as NutritionEntry;
  } catch {
    return { error: 'analysis_failed', message: 'Failed to parse response' };
  }
}

/**
 * Send the image to `scan-analyze`. Prefers a Cloudinary URL over base64:
 * URL payload is a few hundred bytes, base64 payload is ~200KB → 1MB, and
 * the round-trip through Supabase → Groq is proportionally faster.
 */
export async function analyzeFood(
  image: ImageData,
  imageUrl?: string | null,
): Promise<NutritionEntry | GroqErrorResponse> {
  try {
    const body: Record<string, unknown> = {};
    if (imageUrl) {
      body.imageUrl = imageUrl;
    } else {
      body.imageBase64 = image.base64;
      body.mimeType = image.mimeType ?? 'image/jpeg';
    }

    const { data, error } = await supabase.functions.invoke<{
      content?: string;
      error?: string;
    }>('scan-analyze', { body });

    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 401) return { error: 'analysis_failed', message: 'auth_required' };
      if (status === 429 || status === 503) {
        return { error: 'network_error', message: 'busy' };
      }
      return { error: 'analysis_failed', message: `edge_${status ?? 'unknown'}` };
    }
    const content = data?.content ?? '';
    if (!content) return { error: 'analysis_failed', message: 'Empty response' };
    return parseAIResponse(content);
  } catch (error) {
    console.error('scan-analyze error:', error);
    return {
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function analyzeFoodWithRetry(
  image: ImageData,
  imageUrl?: string | null,
  maxRetries: number = 2,
): Promise<NutritionEntry | GroqErrorResponse> {
  let lastError: GroqErrorResponse = { error: 'network_error' };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await analyzeFood(image, imageUrl);
    if (!('error' in result) || result.error === 'no_food_detected') return result;
    lastError = result;
    if (result.error !== 'network_error') return result;
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  return lastError;
}

export function isGroqError(
  result: NutritionEntry | GroqErrorResponse,
): result is GroqErrorResponse {
  return 'error' in result;
}
