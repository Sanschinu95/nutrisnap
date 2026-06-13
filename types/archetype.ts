/**
 * Archetype type definitions
 */

export type ArchetypeKey = 
  | 'wolf' 
  | 'bear' 
  | 'lion' 
  | 'deer' 
  | 'tigress' 
  | 'phoenix' 
  | 'doe' 
  | 'swan';

export type ArchetypeTier = 'base' | 'silver' | 'gold' | 'platinum';

export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';

export type GoalType = 'cut' | 'maintain' | 'bulk';

export interface ArchetypeColors {
  primary: string;
  accent: string;
  bg: string;
}

export interface ArchetypeMacros {
  protein: number; // percentage (0-1)
  carbs: number;   // percentage (0-1)
  fat: number;     // percentage (0-1)
}

export interface ArchetypeInfo {
  key: ArchetypeKey;
  name: string;
  emoji: string;
  description: string;
  longDescription: string;
  macros: ArchetypeMacros;
  colors: ArchetypeColors;
  defaultHabits: string[];
  streakNotification: string;
  forSex: BiologicalSex[];
}
