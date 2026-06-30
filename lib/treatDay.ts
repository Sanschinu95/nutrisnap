/**
 * Treat day — reward mechanic that unlocks every 5 consecutive logged days.
 *
 * "Treat" not "cheat": framing matters. The user has earned an indulgent
 * suggestion, not permission to break a diet. Calories are still logged
 * honestly; the coach simply adopts a celebratory tone for the day.
 *
 * Suggestions are AI-generated via Groq (same coach key pool) with a strict
 * JSON output contract; a hard-coded fallback list ships when the API call
 * fails or the JSON parse trips.
 */

import { supabase } from './supabase';
import { getNextCoachKey, markKeyCooling } from './coachKeyPool';
import { logSupabaseError } from './supabaseError';
import type { DietaryPreferences, Profile } from '@/types/database';

export type TreatCategory = 'sweet' | 'savory' | 'beverage' | 'restaurant';

export interface TreatSuggestion {
  name: string;
  description: string;
  category: TreatCategory;
  estimated_calories: number;
  emoji: string;
  pairing_tip?: string;
}

export interface TreatDayRow {
  id: string;
  user_id: string;
  unlocked_at: string;
  used_at: string | null;
  used_date: string | null;
  unlock_reason: string | null;
  suggestions: TreatSuggestion[] | null;
  expires_at: string;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const COACH_MODEL = 'llama-3.3-70b-versatile';
const EXPIRY_DAYS = 14;

function todayLocalDate(): string {
  return new Date().toISOString().split('T')[0];
}

/* ─── Generation ──────────────────────────────────────────────── */

async function generateTreatSuggestions(profile: Profile | null): Promise<TreatSuggestion[]> {
  const prefs = profile?.dietary_preferences ?? null;
  const goal = profile?.goal_type ?? 'maintain';

  const systemPrompt = `You are generating treat day food suggestions for a NutriSnap user who has been consistent with their nutrition logging for 5 days. They've earned an indulgent treat.

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

  let key: string;
  try {
    key = getNextCoachKey();
  } catch {
    return getFallbackSuggestions(prefs);
  }

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: COACH_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate my treat day suggestions.' },
        ],
        max_tokens: 800,
        temperature: 0.8,
      }),
    });

    if (response.status === 429) {
      markKeyCooling(key, 60_000);
      return getFallbackSuggestions(prefs);
    }
    if (!response.ok) {
      markKeyCooling(key, 30_000);
      return getFallbackSuggestions(prefs);
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed) || parsed.length === 0) return getFallbackSuggestions(prefs);
    return parsed
      .filter((s) => s && typeof s === 'object' && typeof s.name === 'string')
      .slice(0, 6) as TreatSuggestion[];
  } catch {
    return getFallbackSuggestions(prefs);
  }
}

function getFallbackSuggestions(preferences: DietaryPreferences | null): TreatSuggestion[] {
  const isVeg =
    Array.isArray(preferences?.diets) &&
    (preferences.diets.includes('vegetarian') || preferences.diets.includes('vegan'));

  const vegOptions: TreatSuggestion[] = [
    {
      name: 'Gulab Jamun',
      description: 'Warm syrup-soaked dumplings, melt-in-mouth',
      category: 'sweet',
      estimated_calories: 350,
      emoji: '🍮',
    },
    {
      name: 'Masala Dosa',
      description: 'Crispy rice crepe with spiced potato, chutneys, sambar',
      category: 'savory',
      estimated_calories: 480,
      emoji: '🥞',
    },
    {
      name: 'Pav Bhaji',
      description: 'Buttery vegetable mash with toasted pav buns',
      category: 'savory',
      estimated_calories: 620,
      emoji: '🍞',
    },
    {
      name: 'Mango Lassi',
      description: 'Thick, sweet yogurt drink with ripe mango',
      category: 'beverage',
      estimated_calories: 280,
      emoji: '🥭',
    },
    {
      name: 'Paneer Tikka Pizza',
      description: 'Restaurant-style with charred paneer and onions',
      category: 'restaurant',
      estimated_calories: 850,
      emoji: '🍕',
    },
  ];

  const nonVegOptions: TreatSuggestion[] = [
    {
      name: 'Butter Chicken',
      description: 'Creamy tomato gravy, tender chicken, naan on the side',
      category: 'restaurant',
      estimated_calories: 720,
      emoji: '🍗',
    },
    {
      name: 'Biryani',
      description: 'Aromatic rice with marinated meat and saffron',
      category: 'savory',
      estimated_calories: 680,
      emoji: '🍚',
    },
    {
      name: 'Chocolate Brownie Sundae',
      description: 'Warm brownie, vanilla ice cream, hot fudge',
      category: 'sweet',
      estimated_calories: 580,
      emoji: '🍨',
    },
  ];

  return isVeg ? vegOptions : [...vegOptions.slice(0, 3), ...nonVegOptions];
}

/* ─── Database actions ────────────────────────────────────────── */

export async function unlockTreatDay(
  userId: string,
  reason: string,
  profile: Profile | null,
): Promise<TreatDayRow | null> {
  const suggestions = await generateTreatSuggestions(profile);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

  const { data, error } = await supabase
    .from('treat_days')
    .insert({
      user_id: userId,
      unlock_reason: reason,
      suggestions,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    logSupabaseError('treat_days.insert', error);
    return null;
  }
  return data as TreatDayRow;
}

export async function activateTreatDay(treatId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('treat_days')
    .update({
      used_at: new Date().toISOString(),
      used_date: todayLocalDate(),
    })
    .eq('id', treatId)
    .eq('user_id', userId);
  logSupabaseError('treat_days.update(activate)', error);
}

export async function getActiveTreatDay(userId: string): Promise<TreatDayRow | null> {
  const { data, error } = await supabase
    .from('treat_days')
    .select('*')
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('unlocked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logSupabaseError('treat_days.select(active)', error);
    return null;
  }
  return (data as TreatDayRow | null) ?? null;
}

export async function isTreatDayActiveToday(userId: string): Promise<TreatDayRow | null> {
  const today = todayLocalDate();
  const { data, error } = await supabase
    .from('treat_days')
    .select('*')
    .eq('user_id', userId)
    .eq('used_date', today)
    .maybeSingle();
  if (error) {
    logSupabaseError('treat_days.select(today)', error);
    return null;
  }
  return (data as TreatDayRow | null) ?? null;
}

/** Returns the most recent unlock timestamp (used or not) for cooldown checks. */
export async function getLastUnlockTimestamp(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('treat_days')
    .select('unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logSupabaseError('treat_days.select(last_unlock)', error);
    return null;
  }
  return data?.unlocked_at ?? null;
}

export function daysBetween(aIso: string, bYmd: string): number {
  const a = new Date(aIso);
  a.setHours(0, 0, 0, 0);
  const [y, m, d] = bYmd.split('-').map(Number);
  const b = new Date(y, m - 1, d);
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}
