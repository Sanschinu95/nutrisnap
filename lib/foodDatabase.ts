/**
 * Indian Food Database - 40 common foods with macros per 100g
 * Used by the plan engine to build meal suggestions
 */

export interface FoodData {
  name: string;
  calories: number;     // per 100g
  protein_g: number;    // per 100g
  carbs_g: number;      // per 100g
  fat_g: number;        // per 100g
  fiber_g: number;      // per 100g
  category: 'grain' | 'protein' | 'dairy' | 'vegetable' | 'fruit' | 'legume' | 'nut' | 'other';
  mealTypes: ('breakfast' | 'lunch' | 'snack' | 'dinner')[];
  isVegetarian: boolean;
}

export const FOOD_DATABASE: FoodData[] = [
  // Grains
  { name: 'White Rice (cooked)', calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fiber_g: 0.4, category: 'grain', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Brown Rice (cooked)', calories: 123, protein_g: 2.7, carbs_g: 26, fat_g: 1.0, fiber_g: 1.8, category: 'grain', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Roti (wheat)', calories: 297, protein_g: 9.0, carbs_g: 50, fat_g: 7.5, fiber_g: 3.5, category: 'grain', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Oats', calories: 389, protein_g: 17, carbs_g: 66, fat_g: 7, fiber_g: 10, category: 'grain', mealTypes: ['breakfast'], isVegetarian: true },
  { name: 'Poha', calories: 110, protein_g: 2.5, carbs_g: 23, fat_g: 0.6, fiber_g: 0.5, category: 'grain', mealTypes: ['breakfast'], isVegetarian: true },
  { name: 'Upma', calories: 135, protein_g: 3.0, carbs_g: 18, fat_g: 5.5, fiber_g: 1.5, category: 'grain', mealTypes: ['breakfast'], isVegetarian: true },
  { name: 'Idli (2 pcs)', calories: 156, protein_g: 4.0, carbs_g: 30, fat_g: 1.0, fiber_g: 1.0, category: 'grain', mealTypes: ['breakfast'], isVegetarian: true },
  { name: 'Dosa (plain)', calories: 120, protein_g: 3.5, carbs_g: 18, fat_g: 3.5, fiber_g: 0.8, category: 'grain', mealTypes: ['breakfast', 'dinner'], isVegetarian: true },
  { name: 'Bread (whole wheat)', calories: 247, protein_g: 13, carbs_g: 41, fat_g: 3.4, fiber_g: 7, category: 'grain', mealTypes: ['breakfast', 'snack'], isVegetarian: true },
  { name: 'Muesli', calories: 340, protein_g: 9, carbs_g: 60, fat_g: 8, fiber_g: 7, category: 'grain', mealTypes: ['breakfast'], isVegetarian: true },

  // Proteins
  { name: 'Chicken Breast', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, category: 'protein', mealTypes: ['lunch', 'dinner'], isVegetarian: false },
  { name: 'Eggs (boiled, 2)', calories: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, fiber_g: 0, category: 'protein', mealTypes: ['breakfast', 'snack'], isVegetarian: true },
  { name: 'Paneer', calories: 265, protein_g: 18, carbs_g: 1.2, fat_g: 21, fiber_g: 0, category: 'protein', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Tofu', calories: 76, protein_g: 8, carbs_g: 1.9, fat_g: 4.8, fiber_g: 0.3, category: 'protein', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Whey Protein (scoop)', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fiber_g: 0, category: 'protein', mealTypes: ['breakfast', 'snack'], isVegetarian: true },

  // Legumes
  { name: 'Moong Dal (cooked)', calories: 105, protein_g: 7.0, carbs_g: 18, fat_g: 0.4, fiber_g: 1.5, category: 'legume', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Masoor Dal (cooked)', calories: 116, protein_g: 9.0, carbs_g: 20, fat_g: 0.4, fiber_g: 1.8, category: 'legume', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Rajma (cooked)', calories: 127, protein_g: 8.7, carbs_g: 22, fat_g: 0.5, fiber_g: 6.4, category: 'legume', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Chole (cooked)', calories: 164, protein_g: 8.9, carbs_g: 27, fat_g: 2.6, fiber_g: 7.6, category: 'legume', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Sprouts (moong)', calories: 31, protein_g: 3.0, carbs_g: 4.0, fat_g: 0.2, fiber_g: 1.8, category: 'legume', mealTypes: ['breakfast', 'snack'], isVegetarian: true },

  // Dairy
  { name: 'Curd (plain)', calories: 98, protein_g: 11, carbs_g: 3.4, fat_g: 4.3, fiber_g: 0, category: 'dairy', mealTypes: ['lunch', 'dinner', 'snack'], isVegetarian: true },
  { name: 'Milk (full fat)', calories: 62, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3, fiber_g: 0, category: 'dairy', mealTypes: ['breakfast', 'snack'], isVegetarian: true },

  // Vegetables
  { name: 'Palak (spinach)', calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, fiber_g: 2.2, category: 'vegetable', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Bhindi (okra)', calories: 33, protein_g: 1.9, carbs_g: 7.5, fat_g: 0.2, fiber_g: 3.2, category: 'vegetable', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Brinjal (eggplant)', calories: 25, protein_g: 1.0, carbs_g: 6.0, fat_g: 0.2, fiber_g: 3.0, category: 'vegetable', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Aloo (potato)', calories: 77, protein_g: 2.0, carbs_g: 17, fat_g: 0.1, fiber_g: 2.2, category: 'vegetable', mealTypes: ['breakfast', 'lunch', 'dinner'], isVegetarian: true },
  { name: 'Sweet Potato', calories: 86, protein_g: 1.6, carbs_g: 20, fat_g: 0.1, fiber_g: 3.0, category: 'vegetable', mealTypes: ['lunch', 'dinner', 'snack'], isVegetarian: true },
  { name: 'Tomato', calories: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, fiber_g: 1.2, category: 'vegetable', mealTypes: ['lunch', 'dinner'], isVegetarian: true },
  { name: 'Cucumber', calories: 15, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1, fiber_g: 0.5, category: 'vegetable', mealTypes: ['snack', 'lunch'], isVegetarian: true },
  { name: 'Carrot', calories: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2, fiber_g: 2.8, category: 'vegetable', mealTypes: ['snack', 'lunch'], isVegetarian: true },
  { name: 'Sambar', calories: 65, protein_g: 3.5, carbs_g: 10, fat_g: 1.5, fiber_g: 2.0, category: 'vegetable', mealTypes: ['breakfast', 'lunch', 'dinner'], isVegetarian: true },
  { name: 'Coconut Chutney', calories: 130, protein_g: 1.5, carbs_g: 6, fat_g: 11, fiber_g: 2.0, category: 'vegetable', mealTypes: ['breakfast'], isVegetarian: true },

  // Fruits
  { name: 'Banana', calories: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3, fiber_g: 2.6, category: 'fruit', mealTypes: ['breakfast', 'snack'], isVegetarian: true },
  { name: 'Apple', calories: 52, protein_g: 0.3, carbs_g: 14, fat_g: 0.2, fiber_g: 2.4, category: 'fruit', mealTypes: ['snack'], isVegetarian: true },

  // Nuts & Fats
  { name: 'Almonds', calories: 579, protein_g: 21, carbs_g: 22, fat_g: 50, fiber_g: 12, category: 'nut', mealTypes: ['snack'], isVegetarian: true },
  { name: 'Peanut Butter', calories: 588, protein_g: 25, carbs_g: 20, fat_g: 50, fiber_g: 6, category: 'nut', mealTypes: ['breakfast', 'snack'], isVegetarian: true },
  { name: 'Ghee', calories: 900, protein_g: 0, carbs_g: 0, fat_g: 100, fiber_g: 0, category: 'other', mealTypes: ['breakfast', 'lunch', 'dinner'], isVegetarian: true },
  { name: 'Butter', calories: 717, protein_g: 0.9, carbs_g: 0.1, fat_g: 81, fiber_g: 0, category: 'other', mealTypes: ['breakfast'], isVegetarian: true },
];
