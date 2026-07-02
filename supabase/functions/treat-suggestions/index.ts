/**
 * Supabase Edge Function: treat-suggestions
 *
 * Generates the AI-curated indulgent-food list for a newly-unlocked treat
 * day. Called at most once per treat-day unlock (i.e., roughly every 5 days
 * per user), so no per-user quota table — the unlock mechanic is the rate
 * limit.
 *
 * Contract:
 *   POST /treat-suggestions
 *   { "dietaryPreferences": {...} | null, "goalType": "cut" | "bulk" | ... }
 *   →
 *   { "suggestions": TreatSuggestion[] }   // 3–6 items
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const MAX_ATTEMPTS = 2;

interface RequestBody {
  dietaryPreferences?: unknown;
  goalType?: string;
}

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

function buildSystemPrompt(prefs: unknown, goal: string): string {
  return `You are generating treat day food suggestions for a NutriSnap user who has been consistent with their nutrition logging for 5 days. They've earned an indulgent treat.

USER CONTEXT:
- Dietary preferences: ${JSON.stringify(prefs)}
- Goal: ${goal}
- Location: India (use Indian foods, ₹ prices, regional context)

GUIDELINES:
- Suggest 5 indulgent treats. Mix sweet, savory, restaurant items.
- Make them genuinely indulgent and exciting, not "healthy alternatives."
- For each: name (specific, e.g., "Gulab jamun" not "Indian sweet"), brief enticing description, estimated calories, an emoji.
- Include a mix of price points (some ₹50 street food, some ₹500 restaurant items).
- For vegetarians: only veg suggestions.
- For non-vegetarians: include some meat/chicken/fish items.
- Add a pairing tip where natural ("Best with masala chai", "Pair with cold cola").

OUTPUT: ONLY a JSON array. No markdown, no backticks, no explanation. Format:
[
  {"name":"Gulab Jamun","description":"Warm syrup-soaked dumplings, melt-in-mouth","category":"sweet","estimated_calories":350,"emoji":"🍮","pairing_tip":"Best slightly warm with vanilla ice cream"}
]`;
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

  const prefs = body.dietaryPreferences ?? null;
  const goal = typeof body.goalType === 'string' ? body.goalType : 'maintain';

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
            { role: 'system', content: buildSystemPrompt(prefs, goal) },
            { role: 'user', content: 'Generate my treat day suggestions.' },
          ],
          max_tokens: 800,
          temperature: 0.8,
        }),
      });
    } catch {
      markCooling(key, 30_000);
      continue;
    }

    if (res.status === 429) { markCooling(key, 60_000); lastStatus = 429; continue; }
    if (!res.ok) { markCooling(key, 30_000); lastStatus = res.status; continue; }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed: any;
    try { parsed = JSON.parse(clean); }
    catch { return jsonError(502, 'PARSE_FAILED'); }
    if (!Array.isArray(parsed)) return jsonError(502, 'BAD_SHAPE');

    const suggestions = parsed
      .filter((s: any) => s && typeof s === 'object' && typeof s.name === 'string')
      .slice(0, 6);

    return new Response(JSON.stringify({ suggestions }), {
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
