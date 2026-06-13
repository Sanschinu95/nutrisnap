/**
 * Archetype Progress System Constants
 * Defines levels, thresholds, and progress rewards
 */

export type ArchetypeLevel = 'pup' | 'base' | 'alpha' | 'legend';

export interface LevelConfig {
  key: ArchetypeLevel;
  label: string;
  emoji: string;
  minProgress: number;
  maxProgress: number;
}

/** Ordered from lowest to highest tier */
export const ARCHETYPE_LEVELS: LevelConfig[] = [
  { key: 'pup', label: 'Pup', emoji: '🐣', minProgress: 0, maxProgress: 20 },
  { key: 'base', label: 'Base', emoji: '🔰', minProgress: 20, maxProgress: 50 },
  { key: 'alpha', label: 'Alpha', emoji: '⚡', minProgress: 50, maxProgress: 80 },
  { key: 'legend', label: 'Legend', emoji: '👑', minProgress: 80, maxProgress: 100 },
];

/** Max progress value */
export const MAX_PROGRESS = 100;

/** Progress awarded when daily goal is met */
export const GOAL_MET_PROGRESS = 3;

/** Progress awarded when daily goal is NOT met but user logged */
export const GOAL_MISSED_PROGRESS = 1;

/** Streak milestones that trigger notifications */
export const STREAK_MILESTONES = [7, 14, 30, 60, 90] as const;

/**
 * Get the current level config based on progress value
 */
export function getLevelForProgress(progress: number): LevelConfig {
  const clamped = Math.min(Math.max(progress, 0), MAX_PROGRESS);
  for (let i = ARCHETYPE_LEVELS.length - 1; i >= 0; i--) {
    if (clamped >= ARCHETYPE_LEVELS[i].minProgress) {
      return ARCHETYPE_LEVELS[i];
    }
  }
  return ARCHETYPE_LEVELS[0];
}

/**
 * Get the next level config (or null if at max)
 */
export function getNextLevel(progress: number): LevelConfig | null {
  const current = getLevelForProgress(progress);
  const currentIdx = ARCHETYPE_LEVELS.findIndex((l) => l.key === current.key);
  if (currentIdx >= ARCHETYPE_LEVELS.length - 1) return null;
  return ARCHETYPE_LEVELS[currentIdx + 1];
}

/**
 * Calculate percentage within current level bracket
 */
export function getLevelPercentage(progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), MAX_PROGRESS);
  const level = getLevelForProgress(clamped);
  const range = level.maxProgress - level.minProgress;
  if (range === 0) return 100;
  return Math.min(100, ((clamped - level.minProgress) / range) * 100);
}

/**
 * Estimate days until next level
 */
export function daysToNextLevel(progress: number, avgDailyProgress: number = 2): number {
  const next = getNextLevel(progress);
  if (!next) return 0;
  const remaining = next.minProgress - progress;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / avgDailyProgress);
}
