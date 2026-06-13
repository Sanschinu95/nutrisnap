/**
 * Archetype-based daily meal plans, tips, and reminder messages
 * Static config per archetype for the "Today's Plan" section
 */

import type { ArchetypeKey } from '@/types/archetype';

export interface MealSuggestion {
  type: 'breakfast' | 'lunch' | 'dinner';
  emoji: string;
  name: string;
  description: string;
  approxCalories: number;
}

export interface DailyPlan {
  meals: MealSuggestion[];
  tip: string;
  reminders: [string, string];
}

type ArchetypePlanConfig = Record<ArchetypeKey, DailyPlan>;

export const ARCHETYPE_PLANS: ArchetypePlanConfig = {
  wolf: {
    meals: [
      {
        type: 'breakfast',
        emoji: '🥩',
        name: 'Protein Power Bowl',
        description: '4 scrambled eggs, turkey bacon, avocado toast',
        approxCalories: 520,
      },
      {
        type: 'lunch',
        emoji: '🥗',
        name: 'Grilled Chicken Salad',
        description: 'Chicken breast, quinoa, mixed greens, olive oil dressing',
        approxCalories: 580,
      },
      {
        type: 'dinner',
        emoji: '🍖',
        name: 'Steak & Vegetables',
        description: 'Lean sirloin, roasted broccoli, sweet potato',
        approxCalories: 650,
      },
    ],
    tip: 'Wolves thrive on high protein. Aim for 40g+ protein per meal to fuel your inner predator.',
    reminders: [
      'Time to hunt. Your next meal fuels the Wolf.',
      'Protein is power. Don\'t skip your feeding window.',
    ],
  },
  bear: {
    meals: [
      {
        type: 'breakfast',
        emoji: '🥞',
        name: 'Oat Power Stack',
        description: 'Oatmeal with banana, honey, walnuts, and protein powder',
        approxCalories: 550,
      },
      {
        type: 'lunch',
        emoji: '🍗',
        name: 'Chicken Rice Bowl',
        description: 'Grilled chicken, brown rice, steamed vegetables',
        approxCalories: 620,
      },
      {
        type: 'dinner',
        emoji: '🍝',
        name: 'Pasta Bolognese',
        description: 'Whole wheat pasta, lean beef sauce, parmesan',
        approxCalories: 700,
      },
    ],
    tip: 'Bears need balanced fuel. Complex carbs before training give you unstoppable strength.',
    reminders: [
      'Feed the Bear. Balanced meals build balanced power.',
      'Rest and refuel — your body grows when you recover.',
    ],
  },
  lion: {
    meals: [
      {
        type: 'breakfast',
        emoji: '☕',
        name: 'Fasted Morning (Black Coffee)',
        description: 'Intermittent fasting — break your fast at noon',
        approxCalories: 5,
      },
      {
        type: 'lunch',
        emoji: '🥩',
        name: 'King\'s Feast',
        description: 'Salmon fillet, asparagus, brown rice, lemon dressing',
        approxCalories: 700,
      },
      {
        type: 'dinner',
        emoji: '🍗',
        name: 'Lean & Clean',
        description: 'Grilled chicken, roasted sweet potato, kale salad',
        approxCalories: 600,
      },
    ],
    tip: 'Lions lead with discipline. Your morning fast sharpens the mind and controls hunger.',
    reminders: [
      'The pride follows the leader. Show discipline today.',
      'Command your nutrition — every meal is a decision.',
    ],
  },
  deer: {
    meals: [
      {
        type: 'breakfast',
        emoji: '🥤',
        name: 'Green Smoothie Bowl',
        description: 'Spinach, banana, mango, chia seeds, granola topping',
        approxCalories: 420,
      },
      {
        type: 'lunch',
        emoji: '🥙',
        name: 'Mediterranean Wrap',
        description: 'Hummus, falafel, mixed greens, tahini, whole wheat wrap',
        approxCalories: 480,
      },
      {
        type: 'dinner',
        emoji: '🍜',
        name: 'Veggie Stir-fry',
        description: 'Tofu, broccoli, bell peppers, noodles, ginger sauce',
        approxCalories: 450,
      },
    ],
    tip: 'Deer energy comes from plants. Prioritize colorful vegetables and whole grains for endurance.',
    reminders: [
      'Run far, eat clean. Your body is a machine.',
      'Hydrate like nature intended — water is your fuel.',
    ],
  },
  tigress: {
    meals: [
      {
        type: 'breakfast',
        emoji: '🍳',
        name: 'Protein Omelette',
        description: 'Egg whites, spinach, mushrooms, feta cheese',
        approxCalories: 380,
      },
      {
        type: 'lunch',
        emoji: '🥗',
        name: 'Tuna Poke Bowl',
        description: 'Seared tuna, edamame, avocado, brown rice, soy dressing',
        approxCalories: 520,
      },
      {
        type: 'dinner',
        emoji: '🐟',
        name: 'Grilled Salmon',
        description: 'Salmon, quinoa, roasted zucchini, lemon butter',
        approxCalories: 560,
      },
    ],
    tip: 'The Tigress is fierce and lean. Maximize protein to build a strong, sculpted physique.',
    reminders: [
      'Fierce doesn\'t skip meals. Fuel the fire.',
      'Every rep counts, every meal matters. Stay sharp.',
    ],
  },
  phoenix: {
    meals: [
      {
        type: 'breakfast',
        emoji: '🥣',
        name: 'Rise Bowl',
        description: 'Greek yogurt, mixed berries, granola, honey drizzle',
        approxCalories: 400,
      },
      {
        type: 'lunch',
        emoji: '🌯',
        name: 'Turkey Avocado Wrap',
        description: 'Turkey breast, avocado, lettuce, tomato, whole wheat wrap',
        approxCalories: 480,
      },
      {
        type: 'dinner',
        emoji: '🍲',
        name: 'Lentil Soup & Toast',
        description: 'Red lentil soup, whole grain toast, side salad',
        approxCalories: 520,
      },
    ],
    tip: 'The Phoenix transforms through consistency. Every balanced meal is a step toward your new self.',
    reminders: [
      'Rise from the ashes. Today is a new chance.',
      'Transformation happens one meal at a time.',
    ],
  },
  doe: {
    meals: [
      {
        type: 'breakfast',
        emoji: '🍵',
        name: 'Matcha Morning',
        description: 'Matcha latte, whole grain toast, almond butter, banana',
        approxCalories: 380,
      },
      {
        type: 'lunch',
        emoji: '🥗',
        name: 'Garden Bowl',
        description: 'Mixed greens, chickpeas, roasted beets, goat cheese, vinaigrette',
        approxCalories: 440,
      },
      {
        type: 'dinner',
        emoji: '🍝',
        name: 'Veggie Pasta Primavera',
        description: 'Whole wheat penne, seasonal vegetables, light pesto',
        approxCalories: 480,
      },
    ],
    tip: 'Grace comes from mindful eating. Chew slowly and savor each bite for better digestion.',
    reminders: [
      'Move gently, eat mindfully. Your body will thank you.',
      'Nature nourishes — reach for whole, unprocessed foods.',
    ],
  },
  swan: {
    meals: [
      {
        type: 'breakfast',
        emoji: '🥑',
        name: 'Swan\'s Breakfast',
        description: 'Avocado toast, poached eggs, cherry tomatoes, seeds',
        approxCalories: 450,
      },
      {
        type: 'lunch',
        emoji: '🥘',
        name: 'Power Bowl',
        description: 'Grilled chicken, sweet potato, black beans, lime crema',
        approxCalories: 560,
      },
      {
        type: 'dinner',
        emoji: '🐠',
        name: 'Mediterranean Fish',
        description: 'Baked cod, roasted vegetables, couscous, tzatziki',
        approxCalories: 520,
      },
    ],
    tip: 'A Swan glides with elegance. Balanced meals and mindful choices build your discipline.',
    reminders: [
      'Swans never compromise. Fuel your grace.',
      'Elegance is consistent. Stay on course.',
    ],
  },
};

/**
 * Get today's plan for the given archetype
 */
export function getDailyPlan(archetype: ArchetypeKey): DailyPlan {
  return ARCHETYPE_PLANS[archetype];
}

/**
 * Get a random reminder line for the given archetype
 */
export function getRandomReminder(archetype: ArchetypeKey): string {
  const plan = ARCHETYPE_PLANS[archetype];
  const idx = Math.floor(Math.random() * plan.reminders.length);
  return plan.reminders[idx];
}
