// Miroir de api/src/nutritionDefaults.ts (catégories + valeurs de repli),
// pour préremplir le formulaire d'ajout manuel sans aller-retour réseau.
export const DISPLAY_CATEGORIES = [
  "Viande",
  "Poisson",
  "Produit laitier",
  "Légume",
  "Fruit",
  "Féculent",
  "Boisson",
  "Autre",
] as const;

export type DisplayCategory = (typeof DISPLAY_CATEGORIES)[number];

interface NutritionValues {
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

export const CATEGORY_NUTRITION_DEFAULTS: Record<DisplayCategory, NutritionValues> = {
  Viande: { caloriesPer100g: 215, proteinPer100g: 27, fatPer100g: 11, carbsPer100g: 0 },
  Poisson: { caloriesPer100g: 140, proteinPer100g: 22, fatPer100g: 5, carbsPer100g: 0 },
  "Produit laitier": { caloriesPer100g: 120, proteinPer100g: 8, fatPer100g: 7, carbsPer100g: 6 },
  Légume: { caloriesPer100g: 35, proteinPer100g: 2, fatPer100g: 0.3, carbsPer100g: 6 },
  Fruit: { caloriesPer100g: 55, proteinPer100g: 0.6, fatPer100g: 0.3, carbsPer100g: 13 },
  Féculent: { caloriesPer100g: 300, proteinPer100g: 9, fatPer100g: 2, carbsPer100g: 65 },
  Boisson: { caloriesPer100g: 40, proteinPer100g: 0.3, fatPer100g: 0, carbsPer100g: 9 },
  Autre: { caloriesPer100g: 150, proteinPer100g: 5, fatPer100g: 5, carbsPer100g: 15 },
};
