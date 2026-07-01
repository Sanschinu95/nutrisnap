/**
 * Supabase Edge Function: coach-chat
 *
 * The old `lib/coachApi.ts` called Groq directly from the phone with keys
 * shipped in the JS bundle (`EXPO_PUBLIC_GROQ_COACH_KEY_*`). Anyone with the
 * APK could extract them.
 *
 * This function moves the call server-side:
 *   1. Verify the caller is a real Supabase user (JWT in Authorization header,
 *      auto-verified by the platform because we deployed with --no-verify-jwt=false).
 *   2. Enforce a daily per-user quota using `coach_usage_daily`.
 *   3. Round-robin through the Groq coach keys (server env vars, never
 *      exposed to the client).
 *   4. Forward to Groq and return the response payload the client expects.
 *
 * The ACTION line extraction and text cleaning stay on the client — those
 * are presentation concerns that can change without a redeploy.
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const COACH_MODEL = 'llama-3.3-70b-versatile';
const DAILY_LIMIT = 5;
const MAX_ATTEMPTS = 3;

interface CoachMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  systemPrompt: string;
  history: CoachMessage[];
  userMessage: string;
}

/* ─── Key pool (server-side, hot module) ──────────────────────── */

interface KeyState {
  key: string;
  cooldownUntil: number;
}

const keyEnv = ['GROQ_COACH_KEY_1', 'GROQ_COACH_KEY_2'];
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED');
  }

  // 1) Auth — resolve the user from the Authorization header.
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
  const userId = userData.user.id;

  // 2) Parse the body.
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonError(400, 'BAD_JSON');
  }
  if (typeof body?.systemPrompt !== 'string' || typeof body?.userMessage !== 'string') {
    return jsonError(400, 'BAD_SHAPE');
  }
  if (!Array.isArray(body.history)) body.history = [];

  // 3) Rate limit — atomic increment via UPSERT.
  const today = new Date().toISOString().split('T')[0];
  const { data: usageRow, error: usageErr } = await supabase
    .from('coach_usage_daily')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  if (usageErr) {
    console.error('usage_select_failed', usageErr);
    // Fail open — a stuck usage table shouldn't lock users out.
  }
  const usedToday = usageRow?.count ?? 0;
  if (usedToday >= DAILY_LIMIT) {
    return jsonError(429, 'DAILY_LIMIT');
  }

  // 4) Call Groq via key pool with retries.
  if (keys.length === 0) return jsonError(500, 'NO_KEYS_CONFIGURED');
  const messages: CoachMessage[] = [
    { role: 'system', content: body.systemPrompt },
    ...body.history,
    { role: 'user', content: body.userMessage },
  ];

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
        body: JSON.stringify({
          model: COACH_MODEL,
          messages,
          max_tokens: 800,
          temperature: 0.7,
          top_p: 0.9,
        }),
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

    // 5) Bump the usage counter after a successful call. Fire-and-forget so
    //    a hiccup here can't hide a valid reply from the user.
    supabase
      .from('coach_usage_daily')
      .upsert(
        { user_id: userId, date: today, count: usedToday + 1 },
        { onConflict: 'user_id,date' },
      )
      .then(({ error }) => {
        if (error) console.error('usage_upsert_failed', error);
      });

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  return jsonError(lastStatus === 429 ? 503 : 502, 'UPSTREAM_FAILED');
});

function jsonError(status: number, code: string) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
