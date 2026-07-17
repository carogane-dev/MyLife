import { prisma } from "./db.js";
import { calculateNutritionTargets } from "./nutritionCalculator.js";
import type { ActivityLevel, BodyType, GoalMode, NutritionTargets, Sex } from "./nutritionCalculator.js";

export interface MacroAmounts {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface DailyBudgetInfo {
  targets: NutritionTargets;
  remaining: MacroAmounts;
}

// Calcule les objectifs du jour et ce qu'il en reste (objectif - déjà
// mangé aujourd'hui), utilisé aussi bien par le composeur "depuis le
// frigo" que "depuis une recette". Retourne null si le profil n'a pas
// d'objectif calorique (non configuré, ou mode "frigo_only"/"elite" sans
// morphologie choisie).
export async function computeDailyBudget(userId: string): Promise<DailyBudgetInfo | null> {
  const profile = await prisma.nutritionProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const targets = calculateNutritionTargets({
    sex: profile.sex as Sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel as ActivityLevel,
    goalMode: profile.goalMode as GoalMode,
    bodyType: profile.bodyType as BodyType | null,
  });
  if (!targets) return null;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const consumedToday = await prisma.consumptionEntry.findMany({
    where: { userId, consumedAt: { gte: dayStart, lte: dayEnd } },
  });
  const consumed = consumedToday.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      fat: acc.fat + e.fat,
      carbs: acc.carbs + e.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  return {
    targets,
    remaining: {
      calories: Math.max(0, targets.targetCalories - consumed.calories),
      protein: Math.max(0, targets.targetProteinG - consumed.protein),
      fat: Math.max(0, targets.targetFatG - consumed.fat),
      carbs: Math.max(0, targets.targetCarbsG - consumed.carbs),
    },
  };
}

// Une macro est "atteinte" pour la journée si ce qu'il en reste représente
// 5% ou moins de l'objectif — au-delà, on continue de proposer des repas
// plutôt que de s'arrêter dès que les calories seules sont atteintes.
const CLOSE_ENOUGH_RATIO = 0.05;

function isCloseEnough(remainingValue: number, target: number): boolean {
  if (target <= 0) return true;
  return remainingValue <= target * CLOSE_ENOUGH_RATIO;
}

export function isDayComplete(remaining: MacroAmounts, targets: NutritionTargets): boolean {
  return (
    isCloseEnough(remaining.calories, targets.targetCalories) &&
    isCloseEnough(remaining.protein, targets.targetProteinG) &&
    isCloseEnough(remaining.fat, targets.targetFatG) &&
    isCloseEnough(remaining.carbs, targets.targetCarbsG)
  );
}

export function parseMealsRemaining(value: unknown): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) ? Math.min(6, Math.max(1, parsed)) : 3;
}

// Budget alloué à CE repas : une fraction de ce qu'il reste pour la
// journée, avec un petit plancher (3% de l'objectif journalier) pour ne
// pas bloquer un article/ingrédient à cause d'une macro déjà quasi comblée.
export function computeMealBudget(remaining: MacroAmounts, targets: NutritionTargets, mealsRemaining: number): MacroAmounts {
  const meals = Math.max(1, Math.round(mealsRemaining));
  return {
    calories: remaining.calories / meals,
    protein: Math.max(remaining.protein / meals, targets.targetProteinG * 0.03),
    fat: Math.max(remaining.fat / meals, targets.targetFatG * 0.03),
    carbs: Math.max(remaining.carbs / meals, targets.targetCarbsG * 0.03),
  };
}
