import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { buildMealSuggestion } from "../mealBuilder.js";
import { computeDailyBudget, computeSlotBudget, isDayComplete, parseMealsRemaining } from "../dailyBudget.js";
import { isMealSlot } from "../mealSlots.js";
import type { MealSlot } from "../mealSlots.js";

export const mealSuggestionRouter = Router();

mealSuggestionRouter.get("/", requireAuth, async (req, res) => {
  const budgetInfo = await computeDailyBudget(req.user!.id);
  if (!budgetInfo) {
    res.status(200).json({ suggestion: null, reason: "Profil non configuré ou pas d'objectif calorique dans ce mode." });
    return;
  }
  const { targets, remaining, slotContext } = budgetInfo;

  if (isDayComplete(remaining, targets)) {
    res.status(200).json({ suggestion: null, reason: "Objectif du jour déjà atteint sur toutes les macros 🎉" });
    return;
  }

  // Le créneau est toujours transmis explicitement par le front (jamais
  // déduit côté serveur, voir mealSlots.ts) — repli sur "dejeuner" si absent
  // ou invalide plutôt qu'une erreur 400 bloquante.
  const slot: MealSlot = isMealSlot(req.query.slot) ? req.query.slot : "dejeuner";

  const fridgeItems = await prisma.fridgeItem.findMany({ where: { userId: req.user!.id, quantity: { gt: 0 } } });
  if (fridgeItems.length === 0) {
    res.status(200).json({ suggestion: null, reason: "Ton frigo est vide." });
    return;
  }

  const excludeParam = typeof req.query.exclude === "string" ? req.query.exclude : "";
  const excludeIds = new Set(excludeParam.split(",").filter(Boolean));
  const mealsRemaining = parseMealsRemaining(req.query.meals);

  const dailyTargets = { protein: targets.targetProteinG, fat: targets.targetFatG, carbs: targets.targetCarbsG };
  const mealBudget = await computeSlotBudget(req.user!.id, slot, targets, slotContext, mealsRemaining);

  const suggestion = buildMealSuggestion(fridgeItems, mealBudget, dailyTargets, slot, excludeIds);

  if (!suggestion) {
    res.status(200).json({
      suggestion: null,
      reason: "Pas assez d'ingrédients variés dans le frigo pour composer un repas sur ce créneau.",
    });
    return;
  }

  res.status(200).json({ suggestion, remaining });
});
