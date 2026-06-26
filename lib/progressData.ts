/**
 * Aggregations powering the Progress tab — weekly and monthly rollups
 * computed from the meals + hydration_logs tables.
 */

import { supabase } from './supabase';

export interface WeeklyDay {
  date: string;     // YYYY-MM-DD
  day: string;      // 'Mon' .. 'Sun'
  calories: number;
  protein: number;
  waterMl: number;
  mealCount: number;
  isFuture: boolean;
}

export interface WeeklyData {
  days: WeeklyDay[];
  avgCalories: number;
  avgProtein: number;
  avgWaterMl: number;
  activeDays: number;
}

export interface MonthlyDay {
  date: string;     // YYYY-MM-DD
  dayOfMonth: number;
  weekday: number;  // 0 = Mon, 6 = Sun
  mealCount: number;
  isFuture: boolean;
}

export interface MonthlyData {
  days: MonthlyDay[];
  avgCalories: number;
  avgProtein: number;
  avgWaterMl: number;
  activeDays: number;
  totalDays: number;
  monthLabel: string; // e.g. 'June'
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeekMonday(d = new Date()): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = out.getDay(); // 0=Sun..6=Sat
  const delta = dow === 0 ? -6 : 1 - dow; // shift to Monday
  out.setDate(out.getDate() + delta);
  return out;
}

function startOfMonth(d = new Date()): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), 1);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfMonth(d = new Date()): Date {
  const out = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  out.setHours(23, 59, 59, 999);
  return out;
}

interface MealAggRow {
  occurred_at_utc: string;
  total_calories: number | null;
  total_protein: number | null;
}

interface HydrationAggRow {
  occurred_at_utc: string;
  amount_ml: number | null;
}

async function fetchMealsInRange(userId: string, startUtc: Date, endUtc: Date): Promise<MealAggRow[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('occurred_at_utc, total_calories, total_protein')
    .eq('user_id', userId)
    .gte('occurred_at_utc', startUtc.toISOString())
    .lte('occurred_at_utc', endUtc.toISOString());
  if (error) return [];
  return (data ?? []) as MealAggRow[];
}

async function fetchHydrationInRange(userId: string, startUtc: Date, endUtc: Date): Promise<HydrationAggRow[]> {
  const { data, error } = await supabase
    .from('hydration_logs')
    .select('occurred_at_utc, amount_ml')
    .eq('user_id', userId)
    .gte('occurred_at_utc', startUtc.toISOString())
    .lte('occurred_at_utc', endUtc.toISOString());
  if (error) return [];
  return (data ?? []) as HydrationAggRow[];
}

function dateKeyForLocal(iso: string): string {
  const d = new Date(iso);
  return toDateKey(d);
}

export async function loadWeeklyData(userId: string): Promise<WeeklyData> {
  const today = new Date();
  const todayKey = toDateKey(today);
  const monday = startOfWeekMonday(today);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const days: WeeklyDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = toDateKey(d);
    return {
      date: key,
      day: DAY_LABELS[i],
      calories: 0,
      protein: 0,
      waterMl: 0,
      mealCount: 0,
      isFuture: key > todayKey,
    };
  });

  const byDate = new Map<string, WeeklyDay>(days.map((d) => [d.date, d]));

  const [meals, hydration] = await Promise.all([
    fetchMealsInRange(userId, monday, sunday),
    fetchHydrationInRange(userId, monday, sunday),
  ]);

  for (const m of meals) {
    const key = dateKeyForLocal(m.occurred_at_utc);
    const entry = byDate.get(key);
    if (!entry) continue;
    entry.calories += m.total_calories ?? 0;
    entry.protein += Number(m.total_protein ?? 0);
    entry.mealCount += 1;
  }
  for (const h of hydration) {
    const key = dateKeyForLocal(h.occurred_at_utc);
    const entry = byDate.get(key);
    if (!entry) continue;
    entry.waterMl += h.amount_ml ?? 0;
  }

  const realised = days.filter((d) => !d.isFuture && (d.calories > 0 || d.waterMl > 0 || d.mealCount > 0));
  const activeDays = realised.length;
  const safeAvg = (sum: number) => (activeDays > 0 ? sum / activeDays : 0);
  return {
    days,
    avgCalories: Math.round(safeAvg(realised.reduce((s, d) => s + d.calories, 0))),
    avgProtein: Math.round(safeAvg(realised.reduce((s, d) => s + d.protein, 0))),
    avgWaterMl: Math.round(safeAvg(realised.reduce((s, d) => s + d.waterMl, 0))),
    activeDays,
  };
}

export async function loadMonthlyData(userId: string): Promise<MonthlyData> {
  const today = new Date();
  const todayKey = toDateKey(today);
  const start = startOfMonth(today);
  const end = endOfMonth(today);
  const totalDays = end.getDate();
  const monthLabel = today.toLocaleString(undefined, { month: 'long' });

  const days: MonthlyDay[] = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(start);
    d.setDate(i + 1);
    const key = toDateKey(d);
    const dow = d.getDay(); // 0=Sun
    const weekday = dow === 0 ? 6 : dow - 1; // Mon=0 .. Sun=6
    return {
      date: key,
      dayOfMonth: i + 1,
      weekday,
      mealCount: 0,
      isFuture: key > todayKey,
    };
  });

  const byDate = new Map<string, MonthlyDay>(days.map((d) => [d.date, d]));

  const [meals, hydration] = await Promise.all([
    fetchMealsInRange(userId, start, end),
    fetchHydrationInRange(userId, start, end),
  ]);

  // Track aggregates for averages
  const dailyCalories = new Map<string, number>();
  const dailyProtein = new Map<string, number>();
  const dailyWater = new Map<string, number>();

  for (const m of meals) {
    const key = dateKeyForLocal(m.occurred_at_utc);
    const entry = byDate.get(key);
    if (!entry) continue;
    entry.mealCount += 1;
    dailyCalories.set(key, (dailyCalories.get(key) ?? 0) + (m.total_calories ?? 0));
    dailyProtein.set(key, (dailyProtein.get(key) ?? 0) + Number(m.total_protein ?? 0));
  }
  for (const h of hydration) {
    const key = dateKeyForLocal(h.occurred_at_utc);
    if (!byDate.has(key)) continue;
    dailyWater.set(key, (dailyWater.get(key) ?? 0) + (h.amount_ml ?? 0));
  }

  const activeDays = days.filter((d) => !d.isFuture && d.mealCount > 0).length;
  const sumOver = (m: Map<string, number>) =>
    Array.from(m.values()).reduce((a, b) => a + b, 0);
  const safeAvg = (sum: number) => (activeDays > 0 ? sum / activeDays : 0);

  return {
    days,
    avgCalories: Math.round(safeAvg(sumOver(dailyCalories))),
    avgProtein: Math.round(safeAvg(sumOver(dailyProtein))),
    avgWaterMl: Math.round(safeAvg(sumOver(dailyWater))),
    activeDays,
    totalDays,
    monthLabel,
  };
}
