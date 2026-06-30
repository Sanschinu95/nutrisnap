/**
 * Streak milestones — fixed day-thresholds with badge metadata and a reward
 * copy line. The reward TEXT is the real reward (per design principles);
 * badge visuals are a calm hexagon, not a fireworks display.
 */

export interface Milestone {
  days: number;
  name: string;
  description: string;
  emoji: string;
  /** Linear gradient [start, end] for the badge fill. */
  badgeColors: [string, string];
  rewardText: string;
}

export const MILESTONES: Milestone[] = [
  {
    days: 3,
    name: 'Getting Started',
    description: '3 days in a row',
    emoji: '🌱',
    badgeColors: ['#86efac', '#22C55E'],
    rewardText: 'Your first milestone. Keep going.',
  },
  {
    days: 7,
    name: 'One Week',
    description: '7 days of consistency',
    emoji: '🌿',
    badgeColors: ['#22C55E', '#15803d'],
    rewardText: 'A full week. This is becoming a habit.',
  },
  {
    days: 14,
    name: 'Two Weeks',
    description: '14 days strong',
    emoji: '🌳',
    badgeColors: ['#3D8BFF', '#1d4ed8'],
    rewardText: 'Two weeks. Most people quit by now.',
  },
  {
    days: 30,
    name: 'One Month',
    description: '30 days unstoppable',
    emoji: '🔥',
    badgeColors: ['#E8703A', '#c2410c'],
    rewardText: "A full month. You've built something real.",
  },
  {
    days: 60,
    name: 'Two Months',
    description: '60 days of practice',
    emoji: '⚡',
    badgeColors: ['#E0397A', '#9d174d'],
    rewardText: 'This is who you are now. A person who tracks.',
  },
  {
    days: 100,
    name: 'Century',
    description: '100 days. Triple digits.',
    emoji: '💎',
    badgeColors: ['#a855f7', '#6b21a8'],
    rewardText: "100 days. You're in rare company.",
  },
  {
    days: 200,
    name: 'Two Hundred',
    description: '200 days of you',
    emoji: '🏆',
    badgeColors: ['#fbbf24', '#b45309'],
    rewardText: "Most apps don't survive this long. You did.",
  },
  {
    days: 365,
    name: 'One Year',
    description: '365 days. A full circle.',
    emoji: '👑',
    badgeColors: ['#f59e0b', '#92400e'],
    rewardText: "One year. There's no going back to who you were.",
  },
];

export function getNextMilestone(currentStreak: number): Milestone | null {
  return MILESTONES.find((m) => m.days > currentStreak) ?? null;
}

export function getPreviousMilestoneDays(currentStreak: number): number {
  const passed = MILESTONES.filter((m) => m.days <= currentStreak);
  return passed.length === 0 ? 0 : passed[passed.length - 1].days;
}

export function getMilestoneJustReached(streak: number): Milestone | null {
  return MILESTONES.find((m) => m.days === streak) ?? null;
}

export function getUnlockedMilestones(currentStreak: number): Milestone[] {
  return MILESTONES.filter((m) => m.days <= currentStreak);
}

/** Returns the most recently-unlocked milestone, for the pulsing-glow hint. */
export function getMostRecentMilestone(currentStreak: number): Milestone | null {
  const unlocked = getUnlockedMilestones(currentStreak);
  return unlocked.length === 0 ? null : unlocked[unlocked.length - 1];
}
