/**
 * Streaks v2 — owns all streak math, milestones, and grace-day logic.
 *
 * Storage:
 *   - `streaks` table holds the rich state (longest, grace_days_used JSONB,
 *     milestones_reached JSONB, last_meal_logged_at).
 *   - `profiles.streak_count` / `profiles.longest_streak` / `profiles.last_logged_date`
 *     are kept in sync so existing displays (Home flame dots, profile screen)
 *     keep working without further refactor.
 *
 * Grace days: one automatic grace day per rolling 7-day window. Grace days
 * are visible in the UI ("Grace day used on Tuesday") rather than hidden.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { logSupabaseError } from '../lib/supabaseError';
import {
  getMilestoneJustReached,
  type Milestone,
} from '../lib/streakMilestones';
import { useUserStore } from './user.store';
import { daysBetween as daysBetweenIso, getActiveTreatDay, getLastUnlockTimestamp } from '../lib/treatDay';
import { useTreatDayStore } from './treatDay.store';
import {
  cancelStreakAtRiskReminder,
  scheduleStreakAtRiskReminder,
  sendGraceDayUsedNotification,
  sendMilestoneApproachingNotification,
  sendTreatDayUnlockNotification,
} from '../lib/notifications';
import { getNextMilestone } from '../lib/streakMilestones';

export interface MilestoneReached {
  days: number;
  reachedAt: string;
}

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastLoggedDate: string | null;
  /** ISO dates of when grace days were applied. */
  graceDaysUsed: string[];
  milestonesReached: MilestoneReached[];
  justReachedMilestone: Milestone | null;
  /** Filled when applyGraceLogic silently saves the streak — used by the
   *  notification layer to surface a one-time "Grace day used" toast. */
  graceJustUsedDate: string | null;
  currentUserId: string | null;
}

interface StreakActions {
  loadStreak: (userId: string) => Promise<void>;
  recordMealLogged: (userId: string) => Promise<void>;
  clearJustReached: () => void;
  clearGraceJustUsed: () => void;
  isStreakAtRisk: () => boolean;
  resetStreak: (userId: string) => Promise<void>;
  reset: () => void;
}

const initial: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastLoggedDate: null,
  graceDaysUsed: [],
  milestonesReached: [],
  justReachedMilestone: null,
  graceJustUsedDate: null,
  currentUserId: null,
};

function todayLocal(): string {
  return new Date().toISOString().split('T')[0];
}

function dayBefore(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Recent = within rolling 7 days of `today`. */
function recentGraceDays(allUsed: string[], today: string): string[] {
  return allUsed.filter((d) => daysBetween(d, today) <= 7 && daysBetween(d, today) >= 0);
}

interface StreaksRow {
  current_streak_count: number;
  longest_streak: number | null;
  last_logged_date: string | null;
  grace_days_used: string[] | null;
  milestones_reached: MilestoneReached[] | null;
}

export const useStreakStore = create<StreakState & StreakActions>((set, get) => ({
  ...initial,

  loadStreak: async (userId) => {
    if (get().currentUserId !== userId) {
      set({ ...initial, currentUserId: userId });
    }

    const { data, error } = await supabase
      .from('streaks')
      .select(
        'current_streak_count, longest_streak, last_logged_date, grace_days_used, milestones_reached',
      )
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      logSupabaseError('streaks.select', error);
      return;
    }

    let row = (data as StreaksRow | null) ?? null;
    if (!row) {
      const insertRes = await supabase
        .from('streaks')
        .insert({ user_id: userId, current_streak_count: 0, longest_streak: 0 })
        .select(
          'current_streak_count, longest_streak, last_logged_date, grace_days_used, milestones_reached',
        )
        .single();
      if (insertRes.error) {
        logSupabaseError('streaks.insert', insertRes.error);
        return;
      }
      row = insertRes.data as StreaksRow;
    }

    const adjusted = await applyGraceLogicOnLoad(userId, row);
    set({
      currentStreak: adjusted.current_streak_count,
      longestStreak: adjusted.longest_streak ?? 0,
      lastLoggedDate: adjusted.last_logged_date ?? null,
      graceDaysUsed: adjusted.grace_days_used ?? [],
      milestonesReached: adjusted.milestones_reached ?? [],
      graceJustUsedDate: adjusted.graceJustUsedDate ?? null,
      currentUserId: userId,
    });

    // Schedule the 6pm reminder based on the loaded state. Respect prefs.
    const profile = useUserStore.getState().profile;
    const today = todayLocal();
    const alreadyLoggedToday = adjusted.last_logged_date === today;
    if (
      profile?.streak_reminders_enabled !== false &&
      adjusted.current_streak_count >= 3 &&
      !alreadyLoggedToday
    ) {
      scheduleStreakAtRiskReminder(adjusted.current_streak_count);
    } else {
      cancelStreakAtRiskReminder();
    }

    // Surface "Grace day used" as a notification (idempotent: only when the
    // load actually applied one this call).
    if (adjusted.graceJustUsedDate && profile?.streak_reminders_enabled !== false) {
      sendGraceDayUsedNotification();
    }
  },

  recordMealLogged: async (userId) => {
    const state = get();
    const today = todayLocal();

    // Already counted today — no-op.
    if (state.lastLoggedDate === today) return;

    const yesterday = dayBefore(today);
    let newStreak: number;
    let newGraceDaysUsed = [...state.graceDaysUsed];

    if (state.lastLoggedDate === yesterday) {
      newStreak = state.currentStreak + 1;
    } else if (!state.lastLoggedDate) {
      newStreak = 1;
    } else {
      const gap = daysBetween(state.lastLoggedDate, today);
      const recent = recentGraceDays(state.graceDaysUsed, today);
      if (gap === 2 && recent.length === 0) {
        // Exactly one missed day, no grace used in last 7 — auto-grace.
        newStreak = state.currentStreak + 1;
        newGraceDaysUsed = [...state.graceDaysUsed, yesterday];
        set({ graceJustUsedDate: yesterday });
      } else {
        newStreak = 1;
      }
    }

    const newLongest = Math.max(state.longestStreak, newStreak);

    // Milestone check — only fire once per milestone.
    const milestone = getMilestoneJustReached(newStreak);
    let newMilestones = state.milestonesReached;
    let justReached: Milestone | null = null;
    if (milestone && !state.milestonesReached.find((m) => m.days === milestone.days)) {
      newMilestones = [...state.milestonesReached, { days: milestone.days, reachedAt: today }];
      justReached = milestone;
    }

    // Persist to `streaks`.
    const { error: streaksError } = await supabase
      .from('streaks')
      .upsert(
        {
          user_id: userId,
          current_streak_count: newStreak,
          longest_streak: newLongest,
          last_logged_date: today,
          grace_days_used: newGraceDaysUsed,
          milestones_reached: newMilestones,
          last_meal_logged_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    logSupabaseError('streaks.upsert', streaksError);

    // Sync the legacy columns on `profiles` so flame dots / profile counters
    // keep matching without a separate refactor.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        streak_count: newStreak,
        longest_streak: newLongest,
        last_logged_date: today,
      })
      .eq('id', userId);
    logSupabaseError('profiles.update(streak)', profileError);

    // Reflect into user.store so the rest of the app sees the updated values
    // without waiting for a refetch.
    const userProfile = useUserStore.getState().profile;
    if (userProfile) {
      useUserStore.setState({
        streak: newStreak,
        profile: {
          ...userProfile,
          streak_count: newStreak,
          longest_streak: newLongest,
          last_logged_date: today,
        },
      });
    }

    set({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastLoggedDate: today,
      graceDaysUsed: newGraceDaysUsed,
      milestonesReached: newMilestones,
      justReachedMilestone: justReached,
    });

    // Fire-and-forget treat-day unlock check — never blocks the streak update.
    maybeUnlockTreatDay(userId, newStreak, today).catch((err) =>
      console.warn('Treat day unlock check failed:', err),
    );

    // Cancel today's at-risk reminder (we logged); schedule tomorrow's.
    cancelStreakAtRiskReminder();
    const profile = useUserStore.getState().profile;
    if (profile?.streak_reminders_enabled !== false && newStreak >= 3) {
      scheduleStreakAtRiskReminder(newStreak);
    }

    // "One more day" milestone hint: fire if next milestone is exactly 1 day away.
    if (profile?.milestone_notifications_enabled !== false) {
      const next = getNextMilestone(newStreak);
      if (next && next.days - newStreak === 1) {
        sendMilestoneApproachingNotification(next.name);
      }
    }
  },

  clearJustReached: () => set({ justReachedMilestone: null }),
  clearGraceJustUsed: () => set({ graceJustUsedDate: null }),

  isStreakAtRisk: () => {
    const state = get();
    const today = todayLocal();
    const hour = new Date().getHours();
    return state.lastLoggedDate !== today && hour >= 18 && state.currentStreak > 0;
  },

  resetStreak: async (userId) => {
    const { error } = await supabase
      .from('streaks')
      .update({
        current_streak_count: 0,
        grace_days_used: [],
        milestones_reached: [],
        last_logged_date: null,
      })
      .eq('user_id', userId);
    logSupabaseError('streaks.update(reset)', error);

    // Mirror into profiles so the rest of the app doesn't see a stale count.
    const userProfile = useUserStore.getState().profile;
    if (userProfile) {
      await supabase
        .from('profiles')
        .update({ streak_count: 0, last_logged_date: null })
        .eq('id', userId);
      useUserStore.setState({
        streak: 0,
        profile: { ...userProfile, streak_count: 0, last_logged_date: null },
      });
    }

    set({
      currentStreak: 0,
      lastLoggedDate: null,
      graceDaysUsed: [],
      milestonesReached: [],
      justReachedMilestone: null,
      graceJustUsedDate: null,
    });
  },

  reset: () => set({ ...initial }),
}));

/* ─── Treat-day unlock hook (moved out of user.store) ─────────── */

const TREAT_DAY_THRESHOLD = 5;

async function maybeUnlockTreatDay(
  userId: string,
  newStreak: number,
  today: string,
): Promise<void> {
  const profile = useUserStore.getState().profile;
  if (!profile) return;
  if (profile.treat_days_enabled === false) return;
  if (userId.startsWith('guest_')) return;
  if (newStreak < TREAT_DAY_THRESHOLD) return;

  const existing = await getActiveTreatDay(userId);
  if (existing) return;

  const lastUnlockIso = await getLastUnlockTimestamp(userId);
  if (lastUnlockIso && daysBetweenIso(lastUnlockIso, today) < TREAT_DAY_THRESHOLD) return;

  const row = await useTreatDayStore.getState().unlockNow(userId, 'streak_5', profile);
  if (row && profile.treat_day_notifications_enabled !== false) {
    sendTreatDayUnlockNotification();
  }
}

/* ─── Grace-day logic on app load ─────────────────────────────── */

async function applyGraceLogicOnLoad(
  userId: string,
  row: StreaksRow,
): Promise<StreaksRow & { graceJustUsedDate?: string | null }> {
  const today = todayLocal();
  if (!row.last_logged_date) return row;
  if (row.last_logged_date === today) return row;

  const gap = daysBetween(row.last_logged_date, today);
  if (gap <= 1) return row; // yesterday → still alive

  if (gap === 2) {
    const recent = recentGraceDays(row.grace_days_used ?? [], today);
    if (recent.length === 0) {
      const yesterday = dayBefore(today);
      const updatedGrace = [...(row.grace_days_used ?? []), yesterday];
      const { error } = await supabase
        .from('streaks')
        .update({ grace_days_used: updatedGrace })
        .eq('user_id', userId);
      logSupabaseError('streaks.update(grace)', error);
      return { ...row, grace_days_used: updatedGrace, graceJustUsedDate: yesterday };
    }
  }

  if ((row.current_streak_count ?? 0) > 0 && gap > 1) {
    const { error } = await supabase
      .from('streaks')
      .update({ current_streak_count: 0 })
      .eq('user_id', userId);
    logSupabaseError('streaks.update(broken)', error);
    // Mirror into profiles.
    await supabase.from('profiles').update({ streak_count: 0 }).eq('id', userId);
    return { ...row, current_streak_count: 0 };
  }

  return row;
}
