/**
 * Manual-entry helper: estimate nutrition for a typed food name via the
 * coach text model on Groq. Returns macros for one standard serving
 * (Indian sizes when applicable). Does NOT count against the coach's
 * daily question limit.
 */

import { getNextCoachKey, markKeyCooling } from './coachKeyPool';

export interface NutritionEstimate {
  food_name: string;
  serving_size: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a nutrition data API. Given a food item name, return ONLY a JSON object with estimated nutritional values for one standard serving. No explanation, no markdown, no backticks. Just the JSON object.

Format:
{"food_name":"exact name","serving_size":"1 bowl (250g)","calories":350,"protein_g":18,"carbs_g":25,"fat_g":20}

Use Indian serving sizes and recipes when the food is Indian (e.g., dal = 1 bowl/katori ~200ml, roti = 1 piece ~40g, rice = 1 plate ~150g cooked). Be specific about the serving size. Round all numbers to whole integers.`;

export async function estimateNutrition(foodName: string): Promise<NutritionEstimate> {
  const name = foodName.trim();
  if (!name) throw new Error('EMPTY_NAME');

  let key: string;
  try {
    key = getNextCoachKey();
  } catch {
    throw new Error('NO_KEY');
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: name },
      ],
      max_tokens: 150,
      temperature: 0.3,
    }),
  });

  if (response.status === 429) {
    markKeyCooling(key, 60_000);
    throw new Error('RATE_LIMITED');
  }
  if (!response.ok) {
    markKeyCooling(key, 30_000);
    throw new Error(`API_${response.status}`);
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  const clean = text.replace(/```json|```/g, '').trim();

  let parsed: Partial<NutritionEstimate>;
  try {
    parsed = JSON.parse(clean) as Partial<NutritionEstimate>;
  } catch {
    throw new Error('PARSE_FAILED');
  }

  const toInt = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  };

  return {
    food_name: typeof parsed.food_name === 'string' && parsed.food_name ? parsed.food_name : name,
    serving_size: typeof parsed.serving_size === 'string' ? parsed.serving_size : '1 serving',
    calories: toInt(parsed.calories),
    protein_g: toInt(parsed.protein_g),
    carbs_g: toInt(parsed.carbs_g),
    fat_g: toInt(parsed.fat_g),
  };
}
