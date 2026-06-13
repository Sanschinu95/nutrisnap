/**
 * Gemini hook for food analysis
 */

import { useState, useCallback } from 'react';
import { analyzeFoodWithRetry, isGeminiError, type ImageData } from '@/lib/gemini';
import { uploadFoodImage } from '@/lib/cloudinary';
import { useAuthStore } from '@/stores/auth.store';
import type { NutritionEntry, GeminiErrorResponse } from '@/types/nutrition';

interface UseGeminiReturn {
  isAnalyzing: boolean;
  result: (NutritionEntry & { image_url?: string }) | null;
  error: GeminiErrorResponse | null;
  analyze: (image: ImageData, imageUri: string) => Promise<(NutritionEntry & { image_url?: string }) | null>;
  reset: () => void;
}

export function useGemini(): UseGeminiReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<(NutritionEntry & { image_url?: string }) | null>(null);
  const [error, setError] = useState<GeminiErrorResponse | null>(null);

  const analyze = useCallback(async (image: ImageData, imageUri: string): Promise<(NutritionEntry & { image_url?: string }) | null> => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const user = useAuthStore.getState().user;
      
      const uploadPromise = user ? uploadFoodImage(imageUri, user.id).catch(e => {
        console.error('Cloudinary upload failed:', e);
        return null; // fallback gracefully if upload fails
      }) : Promise.resolve(null);

      const analyzePromise = analyzeFoodWithRetry(image);

      const [cloudinaryUrl, response] = await Promise.all([
        uploadPromise,
        analyzePromise,
      ]);

      if (isGeminiError(response)) {
        setError(response);
        setIsAnalyzing(false);
        return null;
      }

      const finalResult = { ...response, image_url: cloudinaryUrl || undefined };
      setResult(finalResult);
      setIsAnalyzing(false);
      return finalResult;
    } catch (e) {
      const errorResponse: GeminiErrorResponse = {
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
