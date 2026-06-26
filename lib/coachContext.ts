/**
 * Builds the system prompt for the AI Nutrition Coach by pulling the user's
 * REAL nutrition data from Supabase + the existing stores. This is what makes
 * the coach feel like it knows you — without rich context here, you have a
 * generic chatbot.
 *
 * Field names are mapped to the real store/DB shapes (NOT the spec's
 * placeholder field names): profile.name, profile.weight_kg, calorieGoal,
 * macroGoals, hydrationGoalMl, meals.occurred_at_utc, hydration_logs.occurred_at_utc.
 */

import { useDailyStore } from '../stores/daily.store';
import { useUserStore } from '../stores/user.store';
import { useAuthStore } from '../stores/auth.store';
import { supabase } from './supabase';

export interface DataInsight {
  emoji: string;
  text: string;
  followUp: string;
}

export interface CoachContext {
  systemPrompt: string;
  dataInsights: DataInsight[];
}

interface DailySummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

interface MealRow {
  occurred_at_utc: string;
  food_items?: Array<{
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
  }> | null;
}

interface HydrationRow {
  occurred_at_utc: string;
  amount_ml: number;
}

export async function buildCoachContext(): Promise<CoachContext> {
  const { profile, calorieGoal, macroGoals, hydrationGoalMl } = useUserStore.getState();
  const daily = useDailyStore.getState();
  const session = useAuthStore.getState().session;
  const userId = session?.user?.id ?? profile?.id ?? null;

  const proteinTarget = macroGoals.protein;
  const waterTarget = hydrationGoalMl;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let recentMeals: MealRow[] = [];
  let recentHydration: HydrationRow[] = [];

  if (userId && !userId.startsWith('guest_')) {
    const [mealsRes, hydrationRes] = await Promise.all([
      supabase
        .from('meals')
        .select('occurred_at_utc, food_items(calories, protein, carbs, fat)')
        .eq('user_id', userId)
        .gte('occurred_at_utc', sevenDaysAgo.toISOString())
        .order('occurred_at_utc', { ascending: false }),
      supabase
        .from('hydration_logs')
        .select('occurred_at_utc, amount_ml')
        .eq('user_id', userId)
        .gte('occurred_at_utc', sevenDaysAgo.toISOString()),
    ]);
    recentMeals = (mealsRes.data ?? []) as MealRow[];
    recentHydration = (hydrationRes.data ?? []) as HydrationRow[];
  }

  const dailySummaries = computeDailySummaries(recentMeals);
  const avgCalories = average(dailySummaries.map((d) => d.calories));
  const avgProtein = average(dailySummaries.map((d) => d.protein));
  const avgWater = computeAvgWater(recentHydration);
  const mealTiming = analyzeMealTiming(recentMeals);
  const proteinTrend = computeTrend(dailySummaries.map((d) => d.protein));

  const totalProteinToday = daily.summary?.total_protein ?? 0;
  const totalCaloriesToday = daily.summary?.total_calories ?? 0;
  const mealsLoggedToday = daily.entries.length;
  const waterToday = daily.waterMl;

  const displayName = profile?.name ?? 'there';
  const goal = profile?.goal_type ?? 'not set';
  const activityTier = profile?.activity_tier ?? 'not set';
  const biologicalSex = profile?.biological_sex ?? 'not set';
  const weightKg = profile?.weight_kg;
  const heightCm = profile?.height_cm;
  const dietary = profile?.dietary_preferences
    ? JSON.stringify(profile.dietary_preferences)
    : 'none specified';

  const systemPrompt = `You are a personal nutrition coach inside NutriSnap, a calm premium nutrition tracking app. You are talking to ${displayName}.

PERSONALITY:
- Warm, encouraging, knowledgeable. Like a friend who happens to know nutrition well.
- Short responses. 3-5 sentences max for simple questions. Never wall-of-text.
- Friendly Indian English (this user is in India). Reference Indian foods naturally — dal, roti, paneer, idli, poha, curd, chana, rajma. Use ₹ for prices.
- Never say "Based on your dietary intake" or "According to your nutrition data." Instead: "I noticed...", "Looking at your week...", "Here's something interesting..."
- Never be judgmental about food choices. No food is "bad." The Route only goes up.
- Always end with ONE specific, actionable recommendation. Not three options. One clear thing to do.

USER PROFILE:
- Name: ${displayName}
- Goal: ${goal}
- Activity level: ${activityTier}
- Biological sex: ${biologicalSex}
- Weight: ${weightKg ? `${weightKg}kg` : 'not set'}
- Height: ${heightCm ? `${heightCm}cm` : 'not set'}
- Dietary preferences: ${dietary}
- Daily calorie target: ${calorieGoal}
- Daily protein target: ${proteinTarget}g
- Daily water target: ${waterTarget}ml

LAST 7 DAYS NUTRITION DATA:
${dailySummaries.length === 0
  ? '(no meals logged yet — the user is new or hasn\'t been tracking)'
  : dailySummaries
      .map(
        (d) =>
          `${d.date}: ${Math.round(d.calories)} cal, ${Math.round(d.protein)}g protein, ${Math.round(d.carbs)}g carbs, ${Math.round(d.fat)}g fat, ${d.mealCount} meals`,
      )
      .join('\n')}

AVERAGES (7-day):
- Calories: ${Math.round(avgCalories)} / ${calorieGoal} target
- Protein: ${Math.round(avgProtein)}g / ${proteinTarget}g target
- Water: ${Math.round(avgWater)}ml / ${waterTarget}ml target

MEAL TIMING PATTERN:
${mealTiming}

PROTEIN TREND: ${proteinTrend}

TODAY SO FAR:
- Calories: ${Math.round(totalCaloriesToday)}
- Protein: ${Math.round(totalProteinToday)}g
- Meals logged: ${mealsLoggedToday}
- Water: ${waterToday}ml

RESPONSE FORMAT:
- Keep responses short and warm. 3-5 sentences for simple questions.
- For meal plans: use a clear structure (Breakfast / Lunch / Dinner / Snack) with approximate calories and protein per meal and estimated cost in ₹.
- For reviews: mention 1-2 strengths first, then 1 area to improve, then 1 action.
- Always end every response with a concrete action in this exact format on its own line:
  ACTION: [one specific thing to do, with numbers]

  Example: "ACTION: Tomorrow breakfast, swap biscuits for 2 boiled eggs + curd (28g protein, ~₹25)"
  Example: "ACTION: Set a phone alarm for 3pm to drink 500ml water"

- The ACTION line will be automatically extracted and shown as a pinnable card. Make it specific, achievable, and cheap.`;

  const dataInsights = generateInsights({
    dailySummaries,
    avgProtein,
    avgCalories,
    avgWater,
    mealTiming,
    proteinTarget,
    calorieTarget: calorieGoal,
    waterTarget,
  });

  return { systemPrompt, dataInsights };
}

/* ─── helpers ─────────────────────────────────────────────── */

function computeDailySummaries(meals: MealRow[]): DailySummary[] {
  const grouped: Record<string, DailySummary> = {};
  for (const meal of meals) {
    const date = new Date(meal.occurred_at_utc).toLocaleDateString('en-IN');
    const bucket = grouped[date] ?? {
      date,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      mealCount: 0,
    };
    for (const item of meal.food_items ?? []) {
      bucket.calories += Number(item.calories ?? 0);
      bucket.protein += Number(item.protein ?? 0);
      bucket.carbs += Number(item.carbs ?? 0);
      bucket.fat += Number(item.fat ?? 0);
    }
    bucket.mealCount += 1;
    grouped[date] = bucket;
  }
  return Object.values(grouped);
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function computeAvgWater(logs: HydrationRow[]): number {
  const byDate: Record<string, number> = {};
  for (const log of logs) {
    const date = new Date(log.occurred_at_utc).toLocaleDateString('en-IN');
    byDate[date] = (byDate[date] ?? 0) + (log.amount_ml ?? 0);
  }
  return average(Object.values(byDate));
}

function analyzeMealTiming(meals: MealRow[]): string {
  let morning = 0;
  let afternoon = 0;
  let evening = 0;
  let night = 0;
  for (const meal of meals) {
    const hour = new Date(meal.occurred_at_utc).getHours();
    if (hour < 11) morning++;
    else if (hour < 16) afternoon++;
    else if (hour < 21) evening++;
    else night++;
  }
  const total = meals.length || 1;
  return `Morning: ${Math.round((morning / total) * 100)}%, Afternoon: ${Math.round((afternoon / total) * 100)}%, Evening: ${Math.round((evening / total) * 100)}%, Night: ${Math.round((night / total) * 100)}%`;
}

function computeTrend(values: number[]): string {
  if (values.length < 3) return 'Not enough data';
  const firstHalf = average(values.slice(0, Math.floor(values.length / 2)));
  const secondHalf = average(values.slice(Math.floor(values.length / 2)));
  const diff = secondHalf - firstHalf;
  if (Math.abs(diff) < 5) return 'Stable';
  return diff > 0 ? `Increasing (+${Math.round(diff)}g)` : `Decreasing (${Math.round(diff)}g)`;
}

function generateInsights(args: {
  dailySummaries: DailySummary[];
  avgProtein: number;
  avgCalories: number;
  avgWater: number;
  mealTiming: string;
  proteinTarget: number;
  calorieTarget: number;
  waterTarget: number;
}): DataInsight[] {
  const { dailySummaries, avgProtein, avgCalories, avgWater, mealTiming, proteinTarget, calorieTarget, waterTarget } = args;
  const insights: DataInsight[] = [];

  if (proteinTarget > 0 && avgProtein > 0 && avgProtein < proteinTarget * 0.75) {
    const gap = Math.round(proteinTarget - avgProtein);
    const lowDays = dailySummaries.filter((d) => d.protein < proteinTarget * 0.8).length;
    insights.push({
      emoji: '💪',
      text: `Your protein has been below target for ${lowDays} of the last 7 days. You're about ${gap}g short on average.`,
      followUp: 'My protein has been low lately. What are easy high-protein Indian foods I can add?',
    });
  }

  if (calorieTarget > 0 && avgCalories > 0 && avgCalories < calorieTarget * 0.7) {
    insights.push({
      emoji: '📉',
      text: `You're averaging ${Math.round(avgCalories)} calories — that's under 70% of your ${calorieTarget} target.`,
      followUp: "I'm not eating enough calories. How do I increase them healthily?",
    });
  }

  const eveningMatch = mealTiming.match(/Evening:\s*(\d+)%/);
  const eveningPct = eveningMatch ? parseInt(eveningMatch[1], 10) : 0;
  if (eveningPct > 55) {
    insights.push({
      emoji: '🌙',
      text: 'Most of your calories land in the evening. Not bad, but spacing them out could help with energy.',
      followUp: 'Most of my eating happens at night. Should I change this and how?',
    });
  }

  if (waterTarget > 0 && avgWater > 0 && avgWater < waterTarget * 0.6) {
    insights.push({
      emoji: '💧',
      text: `Your water intake is averaging ${(avgWater / 1000).toFixed(1)}L — well below your ${(waterTarget / 1000).toFixed(1)}L target.`,
      followUp: 'I keep forgetting to drink water. Help me build a hydration habit.',
    });
  }

  const activeDays = dailySummaries.filter((d) => d.mealCount > 0).length;
  if (activeDays >= 6) {
    insights.push({
      emoji: '🔥',
      text: `You logged meals ${activeDays} out of 7 days last week. That's excellent consistency.`,
      followUp: "I've been consistent this week. What should I focus on improving next?",
    });
  }

  return insights.slice(0, 2);
}
