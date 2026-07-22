import { prisma } from "./db.js";
import { calculateNutritionTargets } from "./nutritionCalculator.js";
import type { ActivityLevel, BodyType, GoalMode, NutritionModeConfigEntry, NutritionTargets, Sex } from "./nutritionCalculator.js";
import { MEAL_SLOTS, normalizedSlotShare } from "./mealSlots.js";
import type { MealSlot } from "./mealSlots.js";
import { computeFloor } from "./mealBudgetMath.js";

// Charge la config de calcul par mode/morphologie depuis la base — voir
// api/prisma/schema.prisma (NutritionModeConfig) pour sa justification.
export async function loadModeConfigs(): Promise<NutritionModeConfigEntry[]> {
  return prisma.nutritionModeConfig.findMany();
}

export interface MacroAmounts {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// Répartition intra-journalière de CE profil (overrides nullable, voir
// mealSlots.normalizedSlotShare pour leur usage) et repères de référence —
// portés par computeDailyBudget pour éviter à computeSlotBudget de
// requêter à nouveau profil/benchmark juste après.
export interface SlotContext {
  breakfastCaloriePercent: number | null;
  lunchCaloriePercent: number | null;
  dinnerCaloriePercent: number | null;
  benchmark: { defaultBreakfastPercent: number; defaultLunchPercent: number; defaultDinnerPercent: number };
}

export interface DailyBudgetInfo {
  targets: NutritionTargets;
  remaining: MacroAmounts;
  slotContext: SlotContext;
}

// Calcule les objectifs du jour et ce qu'il en reste (objectif - déjà
// mangé aujourd'hui), utilisé aussi bien par le composeur "depuis le
// frigo" que "depuis une recette". Retourne null si le profil n'a pas
// d'objectif calorique (non configuré, ou mode "frigo_only"/"elite" sans
// morphologie choisie).
export async function computeDailyBudget(userId: string): Promise<DailyBudgetInfo | null> {
  const profile = await prisma.nutritionProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const modeConfigs = await loadModeConfigs();
  const targets = calculateNutritionTargets(
    {
      sex: profile.sex as Sex,
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      activityLevel: profile.activityLevel as ActivityLevel,
      goalMode: profile.goalMode as GoalMode,
      bodyType: profile.bodyType as BodyType | null,
    },
    modeConfigs
  );
  if (!targets) return null;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const [consumedToday, benchmark] = await Promise.all([
    prisma.consumptionEntry.findMany({ where: { userId, consumedAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.nutritionBenchmark.findFirst(),
  ]);
  const consumed = consumedToday.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      fat: acc.fat + e.fat,
      carbs: acc.carbs + e.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  // La ligne NutritionBenchmark est insérée par migration et n'est jamais
  // supprimée : ce repli n'est qu'un filet de sécurité, pas un chemin
  // normal.
  const resolvedBenchmark = benchmark ?? {
    defaultBreakfastPercent: 0.225,
    defaultLunchPercent: 0.375,
    defaultDinnerPercent: 0.275,
  };

  return {
    targets,
    remaining: {
      calories: Math.max(0, targets.targetCalories - consumed.calories),
      protein: Math.max(0, targets.targetProteinG - consumed.protein),
      fat: Math.max(0, targets.targetFatG - consumed.fat),
      carbs: Math.max(0, targets.targetCarbsG - consumed.carbs),
    },
    slotContext: {
      breakfastCaloriePercent: profile.breakfastCaloriePercent,
      lunchCaloriePercent: profile.lunchCaloriePercent,
      dinnerCaloriePercent: profile.dinnerCaloriePercent,
      benchmark: resolvedBenchmark,
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

// Budget alloué à CE repas, pour CE créneau : part CUMULATIVE de la cible
// journalière (somme des parts de ce créneau et de tous les créneaux qui le
// précèdent dans la journée), moins TOUTE la consommation d'aujourd'hui
// (tous créneaux confondus) — divisé par le nombre de repas restants sur ce
// créneau, avec le même plancher (3% de la cible journalière) qu'auparavant.
//
// Le budget se base sur la consommation TOTALE du jour (pas seulement celle
// de ce créneau) pour rester auto-correcteur d'un créneau à l'autre : si le
// petit-déjeuner dépasse son budget, le déjeuner en tient compte via sa
// part cumulative moins ce qui a déjà été mangé, exactement comme le
// faisait l'ancien budget "reste / repas restants" à l'échelle du jour
// entier. Sans cette correction croisée, chaque créneau viserait sa part
// fixe indépendamment des autres et un dépassement matinal ne serait
// jamais rattrapé. Pour le dernier créneau (dîner), la part cumulative
// vaut exactement 1 (les 3 parts de normalizedSlotShare somment à 1) : le
// budget du dîner redevient alors exactement "tout le reste de la
// journée", identique au comportement d'avant l'introduction des créneaux.
export async function computeSlotBudget(
  userId: string,
  slot: MealSlot,
  targets: NutritionTargets,
  slotContext: SlotContext,
  mealsRemainingInSlot: number
): Promise<MacroAmounts> {
  const slotIndex = MEAL_SLOTS.indexOf(slot);
  const cumulativeShare = MEAL_SLOTS.slice(0, slotIndex + 1).reduce(
    (sum, s) => sum + normalizedSlotShare(slotContext.benchmark, slotContext, s),
    0
  );

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

  const slotRemaining = {
    calories: Math.max(0, targets.targetCalories * cumulativeShare - consumed.calories),
    protein: Math.max(0, targets.targetProteinG * cumulativeShare - consumed.protein),
    fat: Math.max(0, targets.targetFatG * cumulativeShare - consumed.fat),
    carbs: Math.max(0, targets.targetCarbsG * cumulativeShare - consumed.carbs),
  };

  const floor = computeFloor({
    calories: targets.targetCalories,
    protein: targets.targetProteinG,
    fat: targets.targetFatG,
    carbs: targets.targetCarbsG,
  });
  const meals = Math.max(1, Math.round(mealsRemainingInSlot));
  return {
    calories: slotRemaining.calories / meals,
    protein: Math.max(slotRemaining.protein / meals, floor.protein),
    fat: Math.max(slotRemaining.fat / meals, floor.fat),
    carbs: Math.max(slotRemaining.carbs / meals, floor.carbs),
  };
}
