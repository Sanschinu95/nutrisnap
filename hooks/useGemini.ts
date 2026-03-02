/**
 * Gemini hook for food analysis
 */

import { useState, useCallback } from 'react';
import { analyzeFoodWithRetry, isGeminiError, type ImageData } from '@/lib/gemini';
import type { NutritionEntry, GeminiErrorResponse } from '@/types/nutrition';

interface UseGeminiReturn {
  isAnalyzing: boolean;
  result: NutritionEntry | null;
  error: GeminiErrorResponse | null;
  analyze: (image: ImageData) => Promise<NutritionEntry | null>;
  reset: () => void;
}

export function useGemini(): UseGeminiReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<NutritionEntry | null>(null);
  const [error, setError] = useState<GeminiErrorResponse | null>(null);

  const analyze = useCallback(async (image: ImageData): Promise<NutritionEntry | null> => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await analyzeFoodWithRetry(image);

      if (isGeminiError(response)) {
        setError(response);
        setIsAnalyzing(false);
        return null;
      }

      setResult(response);
      setIsAnalyzing(false);
      return response;
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
