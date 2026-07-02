/**
 * Manual-entry helper: estimate nutrition for a typed food name. Backed by
 * the `estimate-nutrition` Supabase Edge Function — keys are server-side.
 */

import { supabase } from './supabase';

export interface NutritionEstimate {
  food_name: string;
  serving_size: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export async function estimateNutrition(foodName: string): Promise<NutritionEstimate> {
  const name = foodName.trim();
  if (!name) throw new Error('EMPTY_NAME');

  const { data, error } = await supabase.functions.invoke<{
    estimate?: NutritionEstimate;
    error?: string;
  }>('estimate-nutrition', {
    body: { foodName: name },
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429 || status === 503) throw new Error('RATE_LIMITED');
    if (status === 401) throw new Error('AUTH_REQUIRED');
    throw new Error(`EDGE_${status ?? 'UNKNOWN'}`);
  }
  if (!data?.estimate) throw new Error('EMPTY_RESPONSE');
  return data.estimate;
}
