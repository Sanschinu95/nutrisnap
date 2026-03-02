/**
 * Streak calculation hook
 */

import { useCallback, useEffect, useState } from 'react';
import { useUserStore } from '@/stores/user.store';

interface UseStreakReturn {
  currentStreak: number;
  longestStreak: number;
  isAtRisk: boolean;
  hasLoggedToday: boolean;
  checkStreak: () => void;
}

export function useStreak(): UseStreakReturn {
  const { profile, streak } = useUserStore();
  const [isAtRisk, setIsAtRisk] = useState(false);
  const [hasLoggedToday, setHasLoggedToday] = useState(false);

  const checkStreak = useCallback(() => {
    if (!profile) {
      setIsAtRisk(false);
      setHasLoggedToday(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const lastLogged = profile.last_logged_date;

    // Check if already logged today
    if (lastLogged === today) {
      setHasLoggedToday(true);
      setIsAtRisk(false);
      return;
    }

    setHasLoggedToday(false);

    // Check if streak is at risk (it's after 9 PM and no log today)
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 21 && streak > 0) {
      setIsAtRisk(true);
    } else {
      setIsAtRisk(false);
    }
  }, [profile, streak]);

  useEffect(() => {
    checkStreak();
    
    // Check every minute after 9 PM
    const interval = setInterval(checkStreak, 60000);
    return () => clearInterval(interval);
  }, [checkStreak]);

  return {
    currentStreak: streak,
    longestStreak: profile?.longest_streak ?? 0,
    isAtRisk,
    hasLoggedToday,
    checkStreak,
  };
}

/**
 * Get streak milestone message
 */
export function getStreakMilestone(days: number): string | null {
  const milestones: Record<number, string> = {
    7: "1 week strong! 🔥",
    14: "2 weeks! You're unstoppable! 💪",
    21: "21 days - it's a habit now! 🌟",
    30: "1 month! Legend status! 👑",
    50: "50 days! Incredible dedication! 🏆",
    100: "100 DAYS! You're extraordinary! 🎯",
    365: "ONE YEAR! Absolute champion! 🏅",
  };

  return milestones[days] ?? null;
}
