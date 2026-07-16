export type Sex = "homme" | "femme" | "autre";
export type ActivityLevel = "sedentaire" | "leger" | "modere" | "actif" | "tres_actif";
export type GoalMode = "precision" | "ligne" | "frigo_only";

export interface NutritionCalculatorInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalMode: GoalMode;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  activityMultiplier: number;
  targetCalories: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  actif: 1.725,
  tres_actif: 1.9,
};

// Volontairement absent pour "frigo_only" : ce mode ne calcule aucune cible.
const GOAL_MODE_CALORIE_MULTIPLIERS: Partial<Record<GoalMode, number>> = {
  precision: 1,
  ligne: 0.9,
};

// Miroir exact de api/src/nutritionCalculator.ts (même formule) — permet un
// aperçu instantané côté client sans aller-retour réseau pendant
// l'onboarding et les Paramètres.
function sexConstant(sex: Sex): number {
  if (sex === "homme") return 5;
  if (sex === "femme") return -161;
  return (5 + -161) / 2;
}

export function calculateNutritionTargets(input: NutritionCalculatorInput): NutritionTargets | null {
  const goalMultiplier = GOAL_MODE_CALORIE_MULTIPLIERS[input.goalMode];
  if (goalMultiplier === undefined) return null;

  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + sexConstant(input.sex);
  const activityMultiplier = ACTIVITY_MULTIPLIERS[input.activityLevel];
  const tdee = bmr * activityMultiplier;
  const targetCalories = Math.round((tdee * goalMultiplier) / 10) * 10;

  const targetProteinG = Math.round(input.weightKg * 1.8);
  const proteinCalories = targetProteinG * 4;
  const targetFatG = Math.round((targetCalories * 0.3) / 9);
  const fatCalories = targetFatG * 9;
  const targetCarbsG = Math.max(0, Math.round((targetCalories - proteinCalories - fatCalories) / 4));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityMultiplier,
    targetCalories,
    targetProteinG,
    targetFatG,
    targetCarbsG,
  };
}
