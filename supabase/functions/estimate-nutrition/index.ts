/**
 * Supabase Edge Function: estimate-nutrition
 *
 * Backs the "Fill with AI" button on the manual-entry form. Server-side
 * so the Groq scan keys aren't shipped in the app bundle. Uses the same
 * key pool as scan-analyze (shares the burst budget); acceptable because
 * Fill-with-AI is called far less than scans.
 *
 * Contract:
 *   POST /estimate-nutrition
 *   { "foodName": "paneer butter masala" }
 *   →
 *   { "estimate": {
 *       "food_name": "...", "serving_size": "...", "calories": n,
 *       "protein_g": n, "carbs_g": n, "fat_g": n
 *     } }
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT = `You are a nutrition data API. Given a food item name, return ONLY a JSON object with estimated nutritional values for one standard serving. No explanation, no markdown, no backticks. Just the JSON object.

Format:
{"food_name":"exact name","serving_size":"1 bowl (250g)","calories":350,"protein_g":18,"carbs_g":25,"fat_g":20}

Use Indian serving sizes and recipes when the food is Indian (e.g., dal = 1 bowl/katori ~200ml, roti = 1 piece ~40g, rice = 1 plate ~150g cooked). Be specific about the serving size. Round all numbers to whole integers.`;

interface RequestBody { foodName: string; }

/* ─── Key pool ────────────────────────────────────────────────── */

interface KeyState { key: string; cooldownUntil: number; }
const keyEnv = [
  'GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3',
  'GROQ_API_KEY_4', 'GROQ_API_KEY_5', 'GROQ_API_KEY_6',
];
const keys: KeyState[] = keyEnv
  .map((n) => Deno.env.get(n))
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED');

  // Auth
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonError(401, 'MISSING_TOKEN');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return jsonError(401, 'INVALID_TOKEN');

  let body: RequestBody;
  try { body = (await req.json()) as RequestBody; }
  catch { return jsonError(400, 'BAD_JSON'); }
  const name = (body?.foodName ?? '').trim();
  if (!name) return jsonError(400, 'MISSING_NAME');

  if (keys.length === 0) return jsonError(500, 'NO_KEYS_CONFIGURED');

  let lastStatus = 500;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const key = nextKey();
    if (!key) return jsonError(503, 'ALL_KEYS_COOLING');

    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
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
    } catch {
      markCooling(key, 30_000);
      continue;
    }

    if (res.status === 429) { markCooling(key, 60_000); lastStatus = 429; continue; }
    if (!res.ok) { markCooling(key, 30_000); lastStatus = res.status; continue; }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed: any;
    try { parsed = JSON.parse(clean); }
    catch { return jsonError(502, 'PARSE_FAILED'); }

    const toInt = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    };

    return new Response(JSON.stringify({
      estimate: {
        food_name: typeof parsed.food_name === 'string' && parsed.food_name ? parsed.food_name : name,
        serving_size: typeof parsed.serving_size === 'string' ? parsed.serving_size : '1 serving',
        calories: toInt(parsed.calories),
        protein_g: toInt(parsed.protein_g),
        carbs_g: toInt(parsed.carbs_g),
        fat_g: toInt(parsed.fat_g),
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  return jsonError(lastStatus === 429 ? 503 : 502, 'UPSTREAM_FAILED');
});

function jsonError(status: number, code: string) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
