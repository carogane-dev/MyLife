export type Sex = "homme" | "femme" | "autre";
export type ActivityLevel = "sedentaire" | "leger" | "modere" | "actif" | "tres_actif";
export type GoalMode = "frigo_only" | "chill" | "ligne" | "elite";
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

export interface ModeConfig {
  calorieMultiplier: number;
  proteinPerKg: number;
  fatPercent: number;
}

// Représente une ligne NutritionModeConfig telle que chargée depuis la base
// (voir dailyBudget.loadModeConfigs côté backend). Ces valeurs vivent en
// base plutôt qu'en constantes ici pour être ajustables sans déploiement de
// code — voir api/prisma/schema.prisma pour leur justification (AMDR/ISSN
// ou choix produit assumé, documenté par le champ `source`).
export interface NutritionModeConfigEntry {
  goalMode: string;
  bodyType: string | null;
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

// "elite" cherche par (goalMode, bodyType) ; les autres modes par (goalMode, null).
function findModeConfig(
  configs: NutritionModeConfigEntry[],
  goalMode: GoalMode,
  bodyType: BodyType | null | undefined
): ModeConfig | undefined {
  if (goalMode === "elite") {
    if (!bodyType) return undefined; // morphologie pas encore choisie
    return configs.find((c) => c.goalMode === "elite" && c.bodyType === bodyType);
  }
  return configs.find((c) => c.goalMode === goalMode && c.bodyType === null);
}

// Constante de sexe dans la formule de Mifflin-St Jeor ; pour "autre", on
// prend la moyenne des deux constantes (+5 et -161) faute de troisième
// variante validée — l'écart entre les deux (~166 kcal sur le BMR) reste
// dans la marge d'erreur habituelle de la formule elle-même.
function sexConstant(sex: Sex): number {
  if (sex === "homme") return 5;
  if (sex === "femme") return -161;
  return (5 + -161) / 2;
}

export function calculateNutritionTargets(
  input: NutritionCalculatorInput,
  modeConfigs: NutritionModeConfigEntry[]
): NutritionTargets | null {
  if (input.goalMode === "frigo_only") return null;
  if (input.goalMode === "elite" && !input.bodyType) return null; // morphologie pas encore choisie

  const config = findModeConfig(modeConfigs, input.goalMode, input.bodyType);
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
