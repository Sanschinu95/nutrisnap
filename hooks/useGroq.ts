/**
 * Groq hook for food analysis
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

      // Always attempt Cloudinary upload — use 'pending' as placeholder
      // if the user hasn't authenticated yet. The upload itself only needs
      // a Cloudinary preset, not a Supabase session.
      const uploadUserId = user?.id ?? 'pending';
      const uploadPromise = uploadFoodImage(imageUri, uploadUserId).catch(e => {
        console.error('Cloudinary upload failed:', e);
        return null;
      });

      const analyzePromise = analyzeFoodWithRetry(image);

      const [cloudinaryUrl, response] = await Promise.all([
        uploadPromise,
        analyzePromise,
      ]);

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

  return {
    isAnalyzing,
    result,
    error,
    analyze,
    reset,
  };
}
