/**
 * Notification copy library — where the personality lives.
 *
 * Voice: a warm Indian friend checking in, never a corporate reminder.
 * Rules baked into every line here:
 *   - Warm concern, never shame. "Missed you, beta" — never "you failed".
 *   - No weight, no "you should eat X calories", no guilt about missed logs.
 *   - "beta" sparingly and warmly; "yaar" / "boss" / "friend" as variation.
 *   - Hindi/English mixed naturally, globally readable.
 *
 * Variants with `requiredContext` reference volatile facts (streak count,
 * weekend, breakfast-logged). They are ONLY eligible for one-shot dynamic
 * notifications where the context is fresh at fire time — the scheduler
 * excludes them from daily-repeating triggers, where a stale "Day 12 of your
 * streak" would eventually be a lie.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNextMilestone } from './streakMilestones';

export interface CopyVariant {
  id: string;
  title: string;
  body: string;
  /**
   * Context keys that must be present AND truthy for this variant.
   * (truthy: booleans true, numbers > 0, strings non-empty)
   */
  requiredContext?: (keyof CopyContext)[];
}

export interface CopyContext {
  /** First name. Falls back to 'friend' in substitution. */
  name: string;
  streak?: number;
  friendCount?: number;
  breakfastLoggedToday?: boolean;
  isWeekend?: boolean;
  /** User's wind-down / regular sleep time, 'HH:MM'. */
  sleepTimeHHMM?: string;
}

export type PersonalityNotificationType =
  | 'meal_breakfast'
  | 'meal_lunch'
  | 'meal_snack'
  | 'meal_dinner'
  | 'hydration'
  | 'sleep_wind_down'
  | 'sleep_check_in'
  | 'streak_at_risk'
  | 'encouragement'
  | 'missed_you';

// ============================================================================
// BREAKFAST (fired at user's breakfast_time)
// ============================================================================
export const BREAKFAST_VARIANTS: CopyVariant[] = [
  { id: 'br_1', title: 'Good morning, {name}', body: "Chai and something to eat? Let's start the day right." },
  { id: 'br_2', title: 'Rise and shine', body: "What's on the plate this morning, {name}?" },
  { id: 'br_3', title: 'Good morning, beta', body: 'Even a small breakfast counts. Snap it when you can.' },
  { id: 'br_4', title: '{name}, breakfast time', body: 'The first meal sets the tone. Nothing fancy needed.' },
  { id: 'br_5', title: 'Namaste', body: "Poha? Idli? Eggs? Whatever it is, let's log it." },
  { id: 'br_6', title: 'Morning, yaar', body: 'You up? Something warm to start the day.' },
  { id: 'br_7', title: '☀️ Fresh start', body: 'Day {streak} of your streak, {name}. Breakfast?', requiredContext: ['streak'] },
  { id: 'br_8', title: 'Good morning', body: 'Rushing today? A banana and some milk still counts.' },
  { id: 'br_9', title: 'Wakey wakey, {name}', body: 'Fuel first. Meetings can wait.' },
  { id: 'br_10', title: 'Morning check-in', body: 'What are we starting with today?' },
  { id: 'br_11', title: 'Hi {name}', body: 'Breakfast on the table? Show it to me.' },
  { id: 'br_12', title: 'Weekend breakfast?', body: "Take your time, but don't skip it entirely.", requiredContext: ['isWeekend'] },
];

// ============================================================================
// LUNCH
// ============================================================================
export const LUNCH_VARIANTS: CopyVariant[] = [
  { id: 'ln_1', title: 'Lunch break, {name}?', body: "Whatever's on the plate — snap it before the first bite." },
  { id: 'ln_2', title: 'Dal chawal time', body: 'Or roti sabzi. Or that meeting sandwich. Log it.' },
  { id: 'ln_3', title: 'Lunch?', body: 'Halfway through the day, {name}. Fuel up properly.' },
  { id: 'ln_4', title: '{name}, hungry yet?', body: 'The screen can wait. Go eat something real.' },
  { id: 'ln_5', title: 'Lunch check', body: "Don't skip it. Even a quick bowl counts." },
  { id: 'ln_6', title: 'Midday, boss', body: 'What are we eating today?' },
  { id: 'ln_7', title: 'Time for lunch', body: "Home food? Zomato? Doesn't matter — just log it." },
  { id: 'ln_8', title: 'Lunch reminder', body: "You logged breakfast today. Let's keep going.", requiredContext: ['breakfastLoggedToday'] },
  { id: 'ln_9', title: '{name}!', body: 'Are you eating properly today? Show me the plate.' },
  { id: 'ln_10', title: 'Halfway there', body: 'Lunch is a good excuse to step away from work.' },
];

// ============================================================================
// SNACK (afternoon, ~5pm)
// ============================================================================
export const SNACK_VARIANTS: CopyVariant[] = [
  { id: 'sn_1', title: 'Chai time, {name}?', body: 'With biscuits, samosa, whatever. Snap it.' },
  { id: 'sn_2', title: "Snack o'clock", body: "Nothing fancy — just what you're eating right now." },
  { id: 'sn_3', title: 'Afternoon slump?', body: 'A quick snack helps. Log it after.' },
  { id: 'sn_4', title: '{name}, chai?', body: 'Log the chai too. Calories are calories.' },
  { id: 'sn_5', title: 'Snack check-in', body: 'What are we munching on?' },
  { id: 'sn_6', title: 'Break time', body: "Fruits? Chips? Nuts? Whatever's in reach." },
  { id: 'sn_7', title: 'Evening snack?', body: 'Better a small bite than skipping and overeating at dinner.' },
  { id: 'sn_8', title: 'Refuel', body: 'Long day, {name}? Something small will help.' },
];

// ============================================================================
// DINNER
// ============================================================================
export const DINNER_VARIANTS: CopyVariant[] = [
  { id: 'dn_1', title: 'Dinner, {name}?', body: 'Last meal of the day. Make it count.' },
  { id: 'dn_2', title: 'Time to eat', body: "What's cooking tonight?" },
  { id: 'dn_3', title: '{name}, food ready?', body: 'Show me the final meal of the day.' },
  { id: 'dn_4', title: 'Evening meal', body: 'Nothing heavy needed. Log whatever it is.' },
  { id: 'dn_5', title: 'Dinner time', body: 'Family food? Ghar ka khana? Something quick? All good.' },
  { id: 'dn_6', title: 'End the day right', body: 'One more meal to log, {name}.' },
  { id: 'dn_7', title: 'Roti or rice?', body: 'Whatever the base, snap it.' },
  { id: 'dn_8', title: 'Last call for dinner', body: "Don't forget to log tonight's meal." },
  { id: 'dn_9', title: "Dinner's ready?", body: "Complete today's Route with one more scan." },
  { id: 'dn_10', title: '{name}!', body: 'Almost bedtime. Log dinner before you forget.' },
];

// ============================================================================
// HYDRATION (fires on the user's cadence during active hours)
// ============================================================================
export const HYDRATION_VARIANTS: CopyVariant[] = [
  { id: 'hy_1', title: 'Water break', body: 'Even a few sips count, {name}.' },
  { id: 'hy_2', title: 'Sip check', body: 'When did you last drink water?' },
  { id: 'hy_3', title: 'Hydration time', body: "Glass of water, right now. I'll wait." },
  { id: 'hy_4', title: '{name}, thirsty?', body: 'Probably. Go drink something.' },
  { id: 'hy_5', title: 'Water pause', body: '2 minute break. Grab a glass.' },
  { id: 'hy_6', title: 'Little sip?', body: "The bottle's right there." },
  { id: 'hy_7', title: 'Drink water, beta', body: 'Simple habit. Big difference.' },
  { id: 'hy_8', title: 'Reminder', body: "Hydration doesn't happen accidentally." },
  { id: 'hy_9', title: 'H2O time', body: "Coffee doesn't count. Water does." },
  { id: 'hy_10', title: 'Ping!', body: 'Glass of water. Come back and log it.' },
  { id: 'hy_11', title: 'Water first', body: 'Before your next task, {name}.' },
  { id: 'hy_12', title: 'Quick check', body: "How much water today? Let's add another glass." },
];

// ============================================================================
// SLEEP WIND-DOWN (at the user's wind-down time)
// ============================================================================
export const SLEEP_WIND_DOWN_VARIANTS: CopyVariant[] = [
  { id: 'sw_1', title: 'Wind down, {name}', body: 'Bed soon. Start putting the phone away.' },
  { id: 'sw_2', title: 'Almost bedtime', body: 'Big day tomorrow needs proper rest tonight.' },
  { id: 'sw_3', title: '{name}, sleep soon', body: 'Your body is asking for rest.' },
  { id: 'sw_4', title: 'Lights out coming', body: 'Wrap things up. Sleep matters more than one more scroll.' },
  { id: 'sw_5', title: 'Reminder', body: "You said you'd sleep at {sleep_time}. It's almost that time.", requiredContext: ['sleepTimeHHMM'] },
  { id: 'sw_6', title: 'Bedtime ritual', body: 'Water, phone away, deep breath. See you tomorrow.' },
  { id: 'sw_7', title: 'Good night soon', body: 'A little wind down goes a long way.' },
  { id: 'sw_8', title: 'Sleep is a habit too', body: 'Just like meals. Show up for it.' },
];

// ============================================================================
// SLEEP CHECK-IN (morning, wake_confirmation_hour + 30 min, if no sleep logged)
// ============================================================================
export const SLEEP_CHECKIN_VARIANTS: CopyVariant[] = [
  { id: 'sc_1', title: 'Good morning, {name}', body: 'Did you sleep well? Tap to log last night.' },
  { id: 'sc_2', title: 'How was sleep?', body: "A quick tap and it's logged for the week." },
  { id: 'sc_3', title: '{name}, rise and shine', body: 'Did you get your hours in? Confirm inside.' },
  { id: 'sc_4', title: 'Morning check-in', body: "Sleep tracker's waiting for you." },
  { id: 'sc_5', title: 'Good morning', body: "Slept on time? Confirm and I'll get out of your way." },
];

// ============================================================================
// STREAK AT RISK (evening, no meal logged and streak >= 3)
// ============================================================================
export const STREAK_AT_RISK_VARIANTS: CopyVariant[] = [
  { id: 'sr_1', title: 'Your {streak}-day streak, {name}', body: 'Log anything before bed. Even a snack counts as showing up.', requiredContext: ['streak'] },
  { id: 'sr_2', title: '{streak} days of showing up', body: "Don't skip today. One quick log keeps it alive.", requiredContext: ['streak'] },
  { id: 'sr_3', title: 'Evening already, {name}', body: 'Your streak is waiting. Log something.', requiredContext: ['streak'] },
  { id: 'sr_4', title: 'Quick check', body: "{streak} days. {next_milestone} is close. Let's not skip today.", requiredContext: ['streak'] },
  { id: 'sr_5', title: '{name}, before you sleep', body: "You've built {streak} days. Log dinner and stay in.", requiredContext: ['streak'] },
  { id: 'sr_6', title: 'Streak check-in', body: '{streak} days strong. One log tonight keeps it going.', requiredContext: ['streak'] },
];

// ============================================================================
// ENCOURAGEMENT (after a full day of logging — positive reinforcement)
// ============================================================================
export const ENCOURAGEMENT_VARIANTS: CopyVariant[] = [
  { id: 'en_1', title: 'Nice work, {name}', body: "Logged 3 meals today. That's a real day." },
  { id: 'en_2', title: 'Showing up', body: "{streak} days in a row. Most people would've quit by now.", requiredContext: ['streak'] },
  { id: 'en_3', title: "{name}, you're steady", body: 'This week has been consistent. Keep it going.' },
  { id: 'en_4', title: 'Good rhythm', body: 'Breakfast, lunch, dinner — all logged today. Solid.' },
  { id: 'en_5', title: 'Proud of you', body: 'You logged even on a busy day. That matters.' },
  { id: 'en_6', title: '{name} 👏', body: "You're building something. One meal at a time." },
  { id: 'en_7', title: 'Quiet win', body: "Nothing dramatic today — just consistency. That's the point." },
];

// ============================================================================
// MISSED YOU (skipped a day — warm concern, NOT guilt)
// ============================================================================
export const MISSED_YOU_VARIANTS: CopyVariant[] = [
  { id: 'my_1', title: 'Missed you yesterday, {name}', body: "Everything okay? Whenever you're ready, I'm here." },
  { id: 'my_2', title: 'Hey {name}', body: "No pressure, but I noticed a quiet day. Hope you're alright." },
  { id: 'my_3', title: 'Checking in', body: 'You skipped a day. Life happens — come back when you can.' },
  { id: 'my_4', title: '{name}, are you okay?', body: "You didn't log yesterday. No judgment. Just wanted to check." },
  { id: 'my_5', title: 'Hi beta', body: 'Missed your logs. Sometimes days get away from us. That’s okay.' },
  { id: 'my_6', title: 'Take your time', body: "Off day yesterday? Let's ease back in today." },
  { id: 'my_7', title: 'Gentle reminder', body: "One skipped day isn't the end. It's a pause. Come back today?" },
  { id: 'my_8', title: '{name}?', body: "Just checking on you. When you're ready, the app's here." },
];

export const VARIANTS_BY_TYPE: Record<PersonalityNotificationType, CopyVariant[]> = {
  meal_breakfast: BREAKFAST_VARIANTS,
  meal_lunch: LUNCH_VARIANTS,
  meal_snack: SNACK_VARIANTS,
  meal_dinner: DINNER_VARIANTS,
  hydration: HYDRATION_VARIANTS,
  sleep_wind_down: SLEEP_WIND_DOWN_VARIANTS,
  sleep_check_in: SLEEP_CHECKIN_VARIANTS,
  streak_at_risk: STREAK_AT_RISK_VARIANTS,
  encouragement: ENCOURAGEMENT_VARIANTS,
  missed_you: MISSED_YOU_VARIANTS,
};

// ============================================================================
// SELECTION + RENDERING
// ============================================================================

function contextSatisfied(variant: CopyVariant, context: CopyContext): boolean {
  if (!variant.requiredContext) return true;
  return variant.requiredContext.every((key) => {
    const value = context[key];
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') return value.length > 0;
    return value === true;
  });
}

/**
 * Picks a variant that:
 * 1. Matches available context (required keys present and truthy)
 * 2. Wasn't used recently (variety — never the same line twice in a week)
 * 3. Is randomly selected from the remaining pool
 *
 * `excludeContextual` drops every variant that has requiredContext at all —
 * used for daily-REPEATING triggers, where volatile context (streak, weekend)
 * would go stale between reschedules.
 */
export function selectVariant(
  variants: CopyVariant[],
  context: CopyContext,
  recentlyUsedIds: string[] = [],
  opts: { excludeContextual?: boolean } = {},
): CopyVariant {
  let eligible = opts.excludeContextual
    ? variants.filter((v) => !v.requiredContext)
    : variants.filter((v) => contextSatisfied(v, context));
  if (eligible.length === 0) eligible = variants.filter((v) => !v.requiredContext);
  if (eligible.length === 0) eligible = variants;

  const fresh = eligible.filter((v) => !recentlyUsedIds.includes(v.id));
  const pool = fresh.length > 0 ? fresh : eligible;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Renders a variant with context substitution. */
export function renderCopy(
  variant: CopyVariant,
  context: CopyContext,
): { title: string; body: string } {
  return {
    title: substitute(variant.title, context),
    body: substitute(variant.body, context),
  };
}

function substitute(template: string, context: CopyContext): string {
  return template
    .replace(/\{name\}/g, firstName(context.name))
    .replace(/\{streak\}/g, String(context.streak ?? ''))
    .replace(/\{friend_count\}/g, String(context.friendCount ?? ''))
    .replace(/\{sleep_time\}/g, formatSleepTime(context.sleepTimeHHMM))
    .replace(/\{next_milestone\}/g, nextMilestoneLabel(context.streak ?? 0));
}

function firstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || 'friend';
}

/** '22:30' → '10:30 PM', '23:00' → '11 PM'. Falls back to a calm default. */
function formatSleepTime(hhmm: string | undefined): string {
  if (!hhmm) return '11 PM';
  const [hRaw, mRaw] = hhmm.split(':').map(Number);
  if (!Number.isFinite(hRaw)) return '11 PM';
  const suffix = hRaw >= 12 ? 'PM' : 'AM';
  const h12 = hRaw % 12 === 0 ? 12 : hRaw % 12;
  const minutes = Number.isFinite(mRaw) && mRaw > 0 ? `:${String(mRaw).padStart(2, '0')}` : '';
  return `${h12}${minutes} ${suffix}`;
}

/** Uses the app's real milestone ladder (3/7/14/30/60/100/200/365). */
function nextMilestoneLabel(streak: number): string {
  const next = getNextMilestone(streak);
  return next ? `Day ${next.days}` : 'the next milestone';
}

// ============================================================================
// VARIETY MEMORY — never the same line twice in a week
// ============================================================================

export type RecentVariantMap = Partial<Record<string, { id: string; at: string }[]>>;

const RECENT_VARIANTS_KEY = 'nyurix.notif.recentVariants.v1';
const VARIANT_MEMORY_DAYS = 7;

export async function loadRecentVariants(): Promise<RecentVariantMap> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_VARIANTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RecentVariantMap;
    const cutoff = Date.now() - VARIANT_MEMORY_DAYS * 24 * 60 * 60 * 1000;
    const pruned: RecentVariantMap = {};
    for (const [type, uses] of Object.entries(parsed)) {
      const kept = (uses ?? []).filter((u) => new Date(u.at).getTime() >= cutoff);
      if (kept.length > 0) pruned[type] = kept;
    }
    return pruned;
  } catch {
    return {};
  }
}

export async function saveRecentVariants(map: RecentVariantMap): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENT_VARIANTS_KEY, JSON.stringify(map));
  } catch {
    // Best-effort; worst case a line repeats sooner than a week.
  }
}

export function recentIdsFor(map: RecentVariantMap, type: string): string[] {
  return (map[type] ?? []).map((u) => u.id);
}

export function rememberUse(map: RecentVariantMap, type: string, id: string): void {
  map[type] = [...(map[type] ?? []), { id, at: new Date().toISOString() }];
}

/** Latest pick per type — used for tap/log attribution. */
export function latestVariantFor(map: RecentVariantMap, type: string): string | null {
  const uses = map[type];
  return uses && uses.length > 0 ? uses[uses.length - 1].id : null;
}
