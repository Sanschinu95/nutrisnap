/**
 * Groq API client for food analysis (with round-robin key rotation)
 * Using Llama 4 Scout Vision model
 */

import type { NutritionEntry, GroqErrorResponse } from '@/types/nutrition';

// Groq API keys with round-robin rotation (loaded from .env.local)
const GROQ_API_KEYS = [
  process.env.EXPO_PUBLIC_GROQ_API_KEY_1,
  process.env.EXPO_PUBLIC_GROQ_API_KEY_2,
  process.env.EXPO_PUBLIC_GROQ_API_KEY_3,
].filter(Boolean) as string[];

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Round-robin key index (persists across calls)
let currentKeyIndex = 0;

function getNextApiKey(): string {
  const key = GROQ_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
  console.log(`Using Groq API key index: ${(currentKeyIndex + GROQ_API_KEYS.length - 1) % GROQ_API_KEYS.length}`);
  return key;
}

const ANALYSIS_PROMPT = `You are an expert nutritionist analyzing food photos for a health tracking app.

Analyze the image and return ONLY a valid JSON object with this exact structure:
{
  "meal_name": "descriptive name (e.g. Grilled Chicken Caesar Salad)",
  "food_items": [
    {
      "name": "string",
      "quantity": "e.g. 1 cup / 200g / 1 medium",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "confidence": "high | medium | low"
    }
  ],
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number,
  "notes": "any observations about the food"
}

Critical rules:
- Be CONSERVATIVE with portion estimates
- List each food component separately
- If multiple dishes visible, list all of them
- If no food detected: { "error": "no_food_detected" }
- Return ONLY valid JSON. No markdown. No explanation.`;

/** Image data passed directly from camera / image picker */
export interface ImageData {
  base64: string;
  mimeType?: string; // defaults to image/jpeg
}

function parseAIResponse(text: string): NutritionEntry | GroqErrorResponse {
  let cleanText = text.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.slice(7);
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.slice(3);
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.slice(0, -3);
  }
  cleanText = cleanText.trim();

  try {
    const parsed = JSON.parse(cleanText);

    if ('error' in parsed) {
      return parsed as GroqErrorResponse;
    }

    if (!parsed.meal_name || !Array.isArray(parsed.food_items)) {
      return { error: 'analysis_failed', message: 'Invalid response structure' };
    }

    return parsed as NutritionEntry;
  } catch {
    return { error: 'analysis_failed', message: 'Failed to parse response' };
  }
}

export async function analyzeFood(
  image: ImageData,
  _retryCount: number = 0
): Promise<NutritionEntry | GroqErrorResponse> {
  try {
    const base64Image = image.base64;
    const mimeType = image.mimeType ?? 'image/jpeg';
    const apiKey = getNextApiKey();

    const payload = {
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: ANALYSIS_PROMPT,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq API error:', errorData);

      // Rate limited — try next key (max one attempt per key)
      if (response.status === 429 && _retryCount < GROQ_API_KEYS.length) {
        console.log(`Rate limited, trying next key (attempt ${_retryCount + 1}/${GROQ_API_KEYS.length})...`);
        return analyzeFood(image, _retryCount + 1);
      }

      return { error: 'analysis_failed', message: `API error: ${response.status}` };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      return { error: 'analysis_failed', message: 'Empty response from API' };
    }

    return parseAIResponse(text);
  } catch (error) {
    console.error('Groq analysis error:', error);
    return {
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function analyzeFoodWithRetry(
  image: ImageData,
  maxRetries: number = 2
): Promise<NutritionEntry | GroqErrorResponse> {
  let lastError: GroqErrorResponse = { error: 'network_error' };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await analyzeFood(image);

    if (!('error' in result) || result.error === 'no_food_detected') {
      return result;
    }

    lastError = result;

    if (result.error !== 'network_error') {
      return result;
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return lastError;
}

export function isGroqError(
  result: NutritionEntry | GroqErrorResponse
): result is GroqErrorResponse {
  return 'error' in result;
}
