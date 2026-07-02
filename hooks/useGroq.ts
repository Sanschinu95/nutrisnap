/**
 * Groq hook for food analysis.
 *
 * Flow after moving Groq server-side:
 *   1. Upload the image to Cloudinary (client → Cloudinary directly)
 *   2. Send the resulting URL to `scan-analyze` Edge Function
 *      → 4 KB request instead of 1 MB base64
 *   3. If Cloudinary fails or isn't configured (dev), fall back to sending
 *      the base64 payload to the Edge Function so scanning still works.
 */

import { useState, useCallback } from 'react';
import { analyzeFoodWithRetry, isGroqError, type ImageData } from '@/lib/groq';
import { uploadFoodImage } from '@/lib/cloudinary';
import { useAuthStore } from '@/stores/auth.store';
import type { NutritionEntry, GroqErrorResponse } from '@/types/nutrition';

interface UseGroqReturn {
  isAnalyzing: boolean;
  result: (NutritionEntry & { image_url?: string }) | null;
  error: GroqErrorResponse | null;
  analyze: (image: ImageData, imageUri: string) => Promise<(NutritionEntry & { image_url?: string }) | null>;
  reset: () => void;
}

export function useGroq(): UseGroqReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<(NutritionEntry & { image_url?: string }) | null>(null);
  const [error, setError] = useState<GroqErrorResponse | null>(null);

  const analyze = useCallback(async (image: ImageData, imageUri: string): Promise<(NutritionEntry & { image_url?: string }) | null> => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const user = useAuthStore.getState().user;
      const uploadUserId = user?.id ?? 'pending';

      // Upload first — the Edge Function then only needs the URL.
      const cloudinaryUrl = await uploadFoodImage(imageUri, uploadUserId).catch((e) => {
        console.warn('Cloudinary upload failed, falling back to base64:', e);
        return null;
      });

      const response = await analyzeFoodWithRetry(image, cloudinaryUrl ?? undefined);

      if (isGroqError(response)) {
        setError(response);
        setIsAnalyzing(false);
        return null;
      }

      const finalResult = { ...response, image_url: cloudinaryUrl || undefined };
      setResult(finalResult);
      setIsAnalyzing(false);
      return finalResult;
    } catch (e) {
      const errorResponse: GroqErrorResponse = {
        error: 'network_error',
        message: e instanceof Error ? e.message : 'Unknown error',
      };
      setError(errorResponse);
      setIsAnalyzing(false);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  return { isAnalyzing, result, error, analyze, reset };
}
