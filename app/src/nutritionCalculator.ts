export type Sex = "homme" | "femme" | "autre";
export type ActivityLevel = "sedentaire" | "leger" | "modere" | "actif" | "tres_actif";
export type GoalMode = "precision" | "ligne" | "elite" | "frigo_only";
export type BodyType = "endurance" | "athletic" | "mass";

export interface NutritionCalculatorInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalMode: GoalMode;
  bodyType?: BodyType | null;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  activityMultiplier: number;
  targetCalories: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
  // Valeurs de la config effectivement appliquée, exposées pour que le
  // texte d'explication n'ait pas besoin de redériver quel mode/morphologie
  // a produit ces chiffres.
  calorieMultiplierUsed: number;
  proteinPerKgUsed: number;
  fatPercentUsed: number;
}

interface ModeConfig {
  calorieMultiplier: number;
  proteinPerKg: number;
  fatPercent: number;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  actif: 1.725,
  tres_actif: 1.9,
};

// "elite" et "frigo_only" ne sont pas ici : "elite" utilise BODY_TYPE_CONFIGS,
// "frigo_only" ne calcule jamais de cible.
const GOAL_MODE_CONFIGS: Partial<Record<GoalMode, ModeConfig>> = {
  precision: { calorieMultiplier: 1.0, proteinPerKg: 1.8, fatPercent: 0.3 },
  // Déficit modéré (15%) + protéines élevées pour préserver le muscle
  // pendant la perte de poids.
  ligne: { calorieMultiplier: 0.85, proteinPerKg: 2.2, fatPercent: 0.25 },
};

export const BODY_TYPE_CONFIGS: Record<BodyType, ModeConfig> = {
  endurance: { calorieMultiplier: 0.95, proteinPerKg: 1.6, fatPercent: 0.25 },
  athletic: { calorieMultiplier: 1.05, proteinPerKg: 2.0, fatPercent: 0.25 },
  mass: { calorieMultiplier: 1.15, proteinPerKg: 2.2, fatPercent: 0.25 },
};

// Constante de sexe dans la formule de Mifflin-St Jeor ; pour "autre", on
// prend la moyenne des deux constantes (+5 et -161) faute de troisième
// variante validée — l'écart entre les deux (~166 kcal sur le BMR) reste
// dans la marge d'erreur habituelle de la formule elle-même.
function sexConstant(sex: Sex): number {
  if (sex === "homme") return 5;
  if (sex === "femme") return -161;
  return (5 + -161) / 2;
}

export function calculateNutritionTargets(input: NutritionCalculatorInput): NutritionTargets | null {
  if (input.goalMode === "frigo_only") return null;

  let config: ModeConfig | undefined;
  if (input.goalMode === "elite") {
    if (!input.bodyType) return null; // morphologie pas encore choisie
    config = BODY_TYPE_CONFIGS[input.bodyType];
  } else {
    config = GOAL_MODE_CONFIGS[input.goalMode];
  }
  if (!config) return null;

  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + sexConstant(input.sex);
  const activityMultiplier = ACTIVITY_MULTIPLIERS[input.activityLevel];
  const tdee = bmr * activityMultiplier;
  const targetCalories = Math.round((tdee * config.calorieMultiplier) / 10) * 10;

  const targetProteinG = Math.round(input.weightKg * config.proteinPerKg);
  const proteinCalories = targetProteinG * 4;
  const targetFatG = Math.round((targetCalories * config.fatPercent) / 9);
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
    calorieMultiplierUsed: config.calorieMultiplier,
    proteinPerKgUsed: config.proteinPerKg,
    fatPercentUsed: config.fatPercent,
  };
}
