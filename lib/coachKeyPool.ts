/**
 * Groq API key rotation for the remaining client-side Groq call sites.
 *
 * HISTORY:
 *  - Coach chat (`lib/coachApi.ts`) used to hit Groq directly from the phone
 *    with `EXPO_PUBLIC_GROQ_COACH_KEY_1/2` inside the JS bundle. It now goes
 *    through the `coach-chat` Supabase Edge Function, so those keys are
 *    server-side only.
 *  - Two client-side call sites still bundle keys:
 *      * `lib/treatDay.ts`         (treat-day suggestion generation)
 *      * `lib/nutritionEstimate.ts` (Fill-with-AI on manual entry)
 *    Both use the scan-key pool via `getNextCoachKey()` for now.
 *
 * TODO: move treatDay + nutritionEstimate behind Edge Functions and delete
 *       this file entirely. Any `EXPO_PUBLIC_*` key is extractable from the
 *       APK.
 */

interface KeyState {
  key: string;
  cooldownUntil: number; // ms epoch; 0 = available
}

function mkKey(key: string | undefined): KeyState {
  return { key: key ?? '', cooldownUntil: 0 };
}

const SCAN_KEYS: KeyState[] = [
  mkKey(process.env.EXPO_PUBLIC_GROQ_API_KEY_1),
  mkKey(process.env.EXPO_PUBLIC_GROQ_API_KEY_2),
  mkKey(process.env.EXPO_PUBLIC_GROQ_API_KEY_3),
  mkKey(process.env.EXPO_PUBLIC_GROQ_API_KEY_4),
  mkKey(process.env.EXPO_PUBLIC_GROQ_API_KEY_5),
  mkKey(process.env.EXPO_PUBLIC_GROQ_API_KEY_6),
];

let cursor = -1;

/**
 * Return an available scan key. Named `getNextCoachKey` for backwards
 * compatibility with treatDay/nutritionEstimate; those call sites should
 * migrate to a dedicated helper (or Edge Function) later.
 */
export function getNextCoachKey(): string {
  const now = Date.now();
  for (let i = 0; i < SCAN_KEYS.length; i++) {
    cursor = (cursor + 1) % SCAN_KEYS.length;
    const k = SCAN_KEYS[cursor];
    if (k.key && k.cooldownUntil < now) return k.key;
  }
  throw new Error('ALL_KEYS_COOLING');
}

export function markKeyCooling(key: string, durationMs: number = 60_000): void {
  const found = SCAN_KEYS.find((k) => k.key === key);
  if (found) found.cooldownUntil = Date.now() + durationMs;
}
