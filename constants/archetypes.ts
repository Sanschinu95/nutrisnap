/**
 * Archetype configurations for NutriSnap
 * Each archetype has specific macro targets and characteristics
 */

import { ArchetypeColors } from './theme';

export type ArchetypeKey = 'wolf' | 'bear' | 'lion' | 'deer' | 'tigress' | 'phoenix' | 'doe' | 'lioness';
export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';

// Macro splits per archetype (protein, carbs, fat as percentage of total calories)
export const ARCHETYPE_MACROS = {
  wolf: { protein: 0.40, carbs: 0.35, fat: 0.25 },
  bear: { protein: 0.35, carbs: 0.45, fat: 0.20 },
  lion: { protein: 0.38, carbs: 0.37, fat: 0.25 },
  deer: { protein: 0.25, carbs: 0.55, fat: 0.20 },
  tigress: { protein: 0.42, carbs: 0.33, fat: 0.25 },
  phoenix: { protein: 0.35, carbs: 0.40, fat: 0.25 },
  doe: { protein: 0.28, carbs: 0.52, fat: 0.20 },
  lioness: { protein: 0.38, carbs: 0.37, fat: 0.25 },
} as const;

export interface Archetype {
  key: ArchetypeKey;
  name: string;
  emoji: string;
  description: string;
  longDescription: string;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  colors: {
    primary: string;
    accent: string;
    bg: string;
  };
  defaultHabits: string[];
  streakNotification: string;
  forSex: BiologicalSex[];
}

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  wolf: {
    key: 'wolf',
    name: 'Wolf',
    emoji: '🐺',
    description: 'High protein hunter',
    longDescription: 'The Wolf archetype thrives on high protein intake, perfect for building lean muscle while staying agile. Wolves are disciplined and focused on their prey - your fitness goals.',
    macros: ARCHETYPE_MACROS.wolf,
    colors: ArchetypeColors.wolf,
    defaultHabits: [
      'Hit protein goal',
      'Walk 8k steps',
      'No processed sugar',
      'Early morning workout',
      'Track all meals',
    ],
    streakNotification: 'Your streak is at risk. Log your last meal, hunter. 🐺',
    forSex: ['male'],
  },
  bear: {
    key: 'bear',
    name: 'Bear',
    emoji: '🐻',
    description: 'Balanced strength builder',
    longDescription: 'The Bear archetype focuses on balanced nutrition with higher carbs for sustained energy. Bears are powerful and methodical, perfect for strength training enthusiasts.',
    macros: ARCHETYPE_MACROS.bear,
    colors: ArchetypeColors.bear,
    defaultHabits: [
      'Eat complex carbs',
      'Strength training 3x/week',
      'Sleep 8+ hours',
      '8 glasses of water',
      'No late night snacking',
    ],
    streakNotification: 'Bears don\'t skip days. Log something before midnight. 🐻',
    forSex: ['male'],
  },
  lion: {
    key: 'lion',
    name: 'Lion',
    emoji: '🦁',
    description: 'Powerful leader',
    longDescription: 'The Lion archetype is for natural leaders who balance protein and carbs for peak performance. Lions command respect through discipline and consistency.',
    macros: ARCHETYPE_MACROS.lion,
    colors: ArchetypeColors.lion,
    defaultHabits: [
      'Morning fasting until noon',
      'High protein lunch',
      'Walk after dinner',
      'Plan meals ahead',
      'Avoid alcohol',
    ],
    streakNotification: 'A Lion never gives up. Log your meal and keep the crown. 👑',
    forSex: ['male'],
  },
  deer: {
    key: 'deer',
    name: 'Deer',
    emoji: '🦌',
    description: 'Plant-powered endurance',
    longDescription: 'The Deer archetype thrives on high carbohydrate, plant-focused nutrition. Perfect for endurance athletes and those who prefer a lighter, more active lifestyle.',
    macros: ARCHETYPE_MACROS.deer,
    colors: ArchetypeColors.deer,
    defaultHabits: [
      'Eat mostly plants',
      'Morning cardio',
      '10k steps daily',
      'Green smoothie',
      'No red meat',
    ],
    streakNotification: 'Keep running, keep logging. Your streak matters. 🦌',
    forSex: ['male'],
  },
  tigress: {
    key: 'tigress',
    name: 'Tigress',
    emoji: '🐯',
    description: 'Fierce & lean',
    longDescription: 'The Tigress archetype maximizes protein for lean muscle definition. Fierce, focused, and unstoppable - perfect for those who want to sculpt a powerful physique.',
    macros: ARCHETYPE_MACROS.tigress,
    colors: ArchetypeColors.tigress,
    defaultHabits: [
      'Hit protein goal',
      'HIIT workout 4x/week',
      'No sugar after 6pm',
      'Meal prep Sundays',
      'Cold shower morning',
    ],
    streakNotification: 'The Tigress never misses. Log now and stay fierce. 🐯',
    forSex: ['female'],
  },
  phoenix: {
    key: 'phoenix',
    name: 'Phoenix',
    emoji: '🔥',
    description: 'Rising transformation',
    longDescription: 'The Phoenix archetype is for those starting a transformation journey. Balanced macros support sustainable change while you rise from the ashes.',
    macros: ARCHETYPE_MACROS.phoenix,
    colors: ArchetypeColors.phoenix,
    defaultHabits: [
      'Walk 10k steps',
      'No skipped meals',
      '8 glasses water',
      'Journal gratitude',
      'Sleep before 11pm',
    ],
    streakNotification: 'Don\'t let the flame die today. You\'re so close. 🔥',
    forSex: ['female'],
  },
  doe: {
    key: 'doe',
    name: 'Doe',
    emoji: '🦌',
    description: 'Graceful & balanced',
    longDescription: 'The Doe archetype embraces a plant-forward, high-carb approach for sustained energy. Graceful and mindful, perfect for yoga enthusiasts and active lifestyles.',
    macros: ARCHETYPE_MACROS.doe,
    colors: ArchetypeColors.doe,
    defaultHabits: [
      'Morning yoga',
      'Plant-based meals',
      'Mindful eating',
      'Nature walk daily',
      'Green tea ritual',
    ],
    streakNotification: 'Stay graceful, stay consistent. Log your meal. 🦌',
    forSex: ['female'],
  },
  lioness: {
    key: 'lioness',
    name: 'Lioness',
    emoji: '🦁',
    description: 'Queen of discipline',
    longDescription: 'The Lioness archetype combines strength and grace with balanced macros. Lead your pride with unwavering discipline and nutritional excellence.',
    macros: ARCHETYPE_MACROS.lioness,
    colors: ArchetypeColors.lioness,
    defaultHabits: [
      'Morning movement',
      'High protein breakfast',
      'Eat whole foods',
      'Weekly meal plan',
      'Evening reflection',
    ],
    streakNotification: 'Queens don\'t break streaks. Log and maintain your reign. 👑',
    forSex: ['female'],
  },
};

// Get archetypes filtered by biological sex
export function getArchetypesForSex(sex: BiologicalSex): Archetype[] {
  if (sex === 'prefer_not_to_say') {
    // Show all archetypes if user doesn't specify
    return Object.values(ARCHETYPES);
  }
  return Object.values(ARCHETYPES).filter((a) => a.forSex.includes(sex));
}

// Get archetype by key
export function getArchetype(key: ArchetypeKey): Archetype {
  return ARCHETYPES[key];
}
