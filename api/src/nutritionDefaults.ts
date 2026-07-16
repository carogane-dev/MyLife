// Catégories affichées dans le Frigo : "Fromage" et "Œufs" n'existent pas en
// tant que catégorie à part, ce sont des aliments laitiers/d'origine animale
// courante — ils vivent comme sous-catégories sous "Produit laitier".
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

// Regroupement plus fin utilisé uniquement pour choisir des valeurs
// nutritionnelles de repli plausibles (un fromage et un yaourt sont tous les
// deux "Produit laitier" à l'affichage, mais leurs valeurs typiques sont très
// différentes).
export const NUTRITION_BUCKETS = [
  "Fromage",
  "Œufs",
  "Viande",
  "Poisson",
  "Produit laitier",
  "Légume",
  "Fruit",
  "Féculent",
  "Boisson",
  "Autre",
] as const;

export type NutritionBucket = (typeof NUTRITION_BUCKETS)[number];

interface NutritionValues {
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

// Valeurs moyennes plausibles pour 100g, utilisées en repli quand le
// code-barres ne fournit pas une donnée précise pour ce champ.
const NUTRITION_DEFAULTS: Record<NutritionBucket, NutritionValues> = {
  Fromage: { caloriesPer100g: 350, proteinPer100g: 24, fatPer100g: 28, carbsPer100g: 2 },
  Œufs: { caloriesPer100g: 155, proteinPer100g: 13, fatPer100g: 11, carbsPer100g: 1 },
  Viande: { caloriesPer100g: 215, proteinPer100g: 27, fatPer100g: 11, carbsPer100g: 0 },
  Poisson: { caloriesPer100g: 140, proteinPer100g: 22, fatPer100g: 5, carbsPer100g: 0 },
  "Produit laitier": { caloriesPer100g: 120, proteinPer100g: 8, fatPer100g: 7, carbsPer100g: 6 },
  Légume: { caloriesPer100g: 35, proteinPer100g: 2, fatPer100g: 0.3, carbsPer100g: 6 },
  Fruit: { caloriesPer100g: 55, proteinPer100g: 0.6, fatPer100g: 0.3, carbsPer100g: 13 },
  Féculent: { caloriesPer100g: 300, proteinPer100g: 9, fatPer100g: 2, carbsPer100g: 65 },
  Boisson: { caloriesPer100g: 40, proteinPer100g: 0.3, fatPer100g: 0, carbsPer100g: 9 },
  Autre: { caloriesPer100g: 150, proteinPer100g: 5, fatPer100g: 5, carbsPer100g: 15 },
};

interface NutrimentsInput {
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
}

export function resolveNutrition(
  nutriments: NutrimentsInput,
  nutritionBucket: NutritionBucket
): NutritionValues & { nutritionEstimated: boolean } {
  const defaults = NUTRITION_DEFAULTS[nutritionBucket];
  let nutritionEstimated = false;

  function resolve(value: number | null, fallback: number): number {
    if (value === null) {
      nutritionEstimated = true;
      return fallback;
    }
    return value;
  }

  return {
    caloriesPer100g: resolve(nutriments.caloriesPer100g, defaults.caloriesPer100g),
    proteinPer100g: resolve(nutriments.proteinPer100g, defaults.proteinPer100g),
    fatPer100g: resolve(nutriments.fatPer100g, defaults.fatPer100g),
    carbsPer100g: resolve(nutriments.carbsPer100g, defaults.carbsPer100g),
    nutritionEstimated,
  };
}
