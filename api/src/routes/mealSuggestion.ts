import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { calculateNutritionTargets } from "../nutritionCalculator.js";
import type { ActivityLevel, BodyType, GoalMode, Sex } from "../nutritionCalculator.js";
import { buildMealSuggestion } from "../mealBuilder.js";

export const mealSuggestionRouter = Router();

// Une macro est considérée "atteinte" pour la journée si ce qu'il en reste
// représente 5% ou moins de l'objectif — au-delà, on continue de proposer
// des repas plutôt que de s'arrêter dès que les calories seules sont
// atteintes (ce qui peut laisser d'autres macros très déséquilibrées).
const CLOSE_ENOUGH_RATIO = 0.05;

function isCloseEnough(remainingValue: number, target: number): boolean {
  if (target <= 0) return true;
  return remainingValue <= target * CLOSE_ENOUGH_RATIO;
}

mealSuggestionRouter.get("/", requireAuth, async (req, res) => {
  const profile = await prisma.nutritionProfile.findUnique({ where: { userId: req.user!.id } });
  if (!profile) {
    res.status(200).json({ suggestion: null, reason: "Profil non configuré." });
    return;
  }

  const targets = calculateNutritionTargets({
    sex: profile.sex as Sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel as ActivityLevel,
    goalMode: profile.goalMode as GoalMode,
    bodyType: profile.bodyType as BodyType | null,
  });

  if (!targets) {
    res.status(200).json({ suggestion: null, reason: "Pas d'objectif calorique dans ce mode." });
    return;
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const consumedToday = await prisma.consumptionEntry.findMany({
    where: { userId: req.user!.id, consumedAt: { gte: dayStart, lte: dayEnd } },
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

  const remaining = {
    calories: Math.max(0, targets.targetCalories - consumed.calories),
    protein: Math.max(0, targets.targetProteinG - consumed.protein),
    fat: Math.max(0, targets.targetFatG - consumed.fat),
    carbs: Math.max(0, targets.targetCarbsG - consumed.carbs),
  };

  const allMacrosCloseEnough =
    isCloseEnough(remaining.calories, targets.targetCalories) &&
    isCloseEnough(remaining.protein, targets.targetProteinG) &&
    isCloseEnough(remaining.fat, targets.targetFatG) &&
    isCloseEnough(remaining.carbs, targets.targetCarbsG);

  if (allMacrosCloseEnough) {
    res.status(200).json({ suggestion: null, reason: "Objectif du jour déjà atteint sur toutes les macros 🎉" });
    return;
  }

  const fridgeItems = await prisma.fridgeItem.findMany({ where: { userId: req.user!.id, quantity: { gt: 0 } } });
  if (fridgeItems.length === 0) {
    res.status(200).json({ suggestion: null, reason: "Ton frigo est vide." });
    return;
  }

  const excludeParam = typeof req.query.exclude === "string" ? req.query.exclude : "";
  const excludeIds = new Set(excludeParam.split(",").filter(Boolean));

  const mealsParam = typeof req.query.meals === "string" ? Number.parseInt(req.query.meals, 10) : NaN;
  const mealsRemaining = Number.isFinite(mealsParam) ? Math.min(6, Math.max(1, mealsParam)) : 3;

  const dailyTargets = { protein: targets.targetProteinG, fat: targets.targetFatG, carbs: targets.targetCarbsG };

  const suggestion = buildMealSuggestion(fridgeItems, remaining, dailyTargets, mealsRemaining, excludeIds);

  if (!suggestion) {
    res.status(200).json({
      suggestion: null,
      reason: "Pas assez d'ingrédients variés dans le frigo pour composer un repas.",
    });
    return;
  }

  res.status(200).json({ suggestion, remaining });
});
