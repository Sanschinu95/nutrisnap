/**
 * Separate Groq key rotation for the AI Nutrition Coach.
 *
 * The coach uses a TEXT model (llama-3.3-70b-versatile) on a different rate
 * limit than the vision model in lib/groq.ts. Two pools so a dinner-time scan
 * rush doesn't eat the coach's quota, with overflow from coach → scan keys.
 *
 * EXPO_PUBLIC_GROQ_COACH_KEY_1/2 in .env.local are the dedicated coach keys.
 * If they're missing or both cooling, we fall through to the existing scan
 * keys so the coach still works for beta without new accounts.
 */

interface KeyState {
  key: string;
  cooldownUntil: number; // ms epoch; 0 = available
}

function mkKey(key: string | undefined): KeyState {
  return { key: key ?? '', cooldownUntil: 0 };
}

const COACH_KEYS: KeyState[] = [
  mkKey(process.env.EXPO_PUBLIC_GROQ_COACH_KEY_1),
  mkKey(process.env.EXPO_PUBLIC_GROQ_COACH_KEY_2),
];

const SCAN_KEYS: KeyState[] = [
  mkKey(process.env.EXPO_PUBLIC_GROQ_API_KEY_1),
  mkKey(process.env.EXPO_PUBLIC_GROQ_API_KEY_2),
  mkKey(process.env.EXPO_PUBLIC_GROQ_API_KEY_3),
];

let lastCoachIndex = -1;

export function getNextCoachKey(): string {
  const now = Date.now();

  // Round-robin through coach keys, skip empty + cooling
  for (let i = 0; i < COACH_KEYS.length; i++) {
    lastCoachIndex = (lastCoachIndex + 1) % COACH_KEYS.length;
    const k = COACH_KEYS[lastCoachIndex];
    if (k.key && k.cooldownUntil < now) return k.key;
  }

  // Overflow: try scan keys (first available)
  for (const k of SCAN_KEYS) {
    if (k.key && k.cooldownUntil < now) return k.key;
  }

  throw new Error('ALL_KEYS_COOLING');
}

export function markKeyCooling(key: string, durationMs: number = 60_000): void {
  for (const pool of [COACH_KEYS, SCAN_KEYS]) {
    const found = pool.find((k) => k.key === key);
    if (found) {
      found.cooldownUntil = Date.now() + durationMs;
      return;
    }
  }
}
