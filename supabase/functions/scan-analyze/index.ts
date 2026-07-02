/**
 * Supabase Edge Function: scan-analyze
 *
 * Vision-model wrapper that used to live in `lib/groq.ts`. The 6 scan keys
 * that were shipped in the JS bundle (`EXPO_PUBLIC_GROQ_API_KEY_1..6`) now
 * only exist as server-side secrets.
 *
 * Client sends either:
 *   - `{ imageUrl }`   — Cloudinary URL (preferred; smaller request payload)
 *   - `{ imageBase64, mimeType }` — data URL fallback for when Cloudinary
 *     is unavailable in dev
 *
 * Function forwards to Groq and returns the raw model content string. The
 * client owns JSON parsing + shape validation, same as before, so prompt or
 * parser tweaks don't need an app release.
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const MAX_ATTEMPTS = 3;

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

interface RequestBody {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
}

/* ─── Key pool (module-scoped hot cache) ──────────────────────── */

interface KeyState { key: string; cooldownUntil: number; }

const keyEnv = [
  'GROQ_API_KEY_1',
  'GROQ_API_KEY_2',
  'GROQ_API_KEY_3',
  'GROQ_API_KEY_4',
  'GROQ_API_KEY_5',
  'GROQ_API_KEY_6',
];
const keys: KeyState[] = keyEnv
  .map((name) => Deno.env.get(name))
  .filter((v): v is string => !!v)
  .map((key) => ({ key, cooldownUntil: 0 }));

let cursor = -1;

function nextKey(): string | null {
  if (keys.length === 0) return null;
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    cursor = (cursor + 1) % keys.length;
    const k = keys[cursor];
    if (k.cooldownUntil < now) return k.key;
  }
  return null;
}

function markCooling(key: string, ms: number) {
  const k = keys.find((k) => k.key === key);
  if (k) k.cooldownUntil = Date.now() + ms;
}

/* ─── HTTP handler ────────────────────────────────────────────── */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED');

  // 1) Auth
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonError(401, 'MISSING_TOKEN');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return jsonError(401, 'INVALID_TOKEN');

  // 2) Parse body
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonError(400, 'BAD_JSON');
  }
  if (!body.imageUrl && !body.imageBase64) {
    return jsonError(400, 'MISSING_IMAGE');
  }

  // 3) Groq expects one of: an https URL, or a data:...;base64,... URI.
  const imageContentUrl = body.imageUrl
    ? body.imageUrl
    : `data:${body.mimeType ?? 'image/jpeg'};base64,${body.imageBase64}`;

  // 4) Call Groq with key-pool + retries
  if (keys.length === 0) return jsonError(500, 'NO_KEYS_CONFIGURED');

  const payload = {
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: ANALYSIS_PROMPT },
          { type: 'image_url', image_url: { url: imageContentUrl } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  };

  let lastStatus = 500;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const key = nextKey();
    if (!key) return jsonError(503, 'ALL_KEYS_COOLING');

    let groqRes: Response;
    try {
      groqRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('groq_fetch_threw', err);
      markCooling(key, 30_000);
      continue;
    }

    if (groqRes.status === 429) {
      markCooling(key, 60_000);
      lastStatus = 429;
      continue;
    }
    if (!groqRes.ok) {
      markCooling(key, 30_000);
      lastStatus = groqRes.status;
      continue;
    }

    const data = await groqRes.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  return jsonError(lastStatus === 429 ? 503 : 502, 'UPSTREAM_FAILED');
});

function jsonError(status: number, code: string) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
