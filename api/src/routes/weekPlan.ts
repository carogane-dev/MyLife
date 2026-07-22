import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { computeDailyBudget } from "../dailyBudget.js";
import { generateWeekPlan } from "../weekPlanner.js";
import { isMealSlot } from "../mealSlots.js";
import { isNonEmptyString } from "../validation.js";

export const weekPlanRouter = Router();

// Le planning porte toujours sur J+1 à J+7 : ne dépend pas de l'heure de
// l'appel (contrairement à /api/meal-suggestion), donc GET et POST
// /regenerate doivent calculer exactement la même date de départ pour que
// les clés `${date}|${slot}` d'un épinglage restent valides d'un appel à
// l'autre le même jour.
function tomorrowMidnight(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Planning des 7 prochains jours (J+1 à J+7) × 3 créneaux, composé à partir
// des recettes communautaires. Route sans état (recalculée à chaque appel,
// pas de persistance pour l'instant — voir weekPlanner.ts).
weekPlanRouter.get("/", requireAuth, async (req, res) => {
  // computeDailyBudget calcule aussi le `remaining` d'aujourd'hui, sans
  // objet ici (le planning porte sur les jours suivants) — seuls
  // `targets`/`slotContext` sont utilisés.
  const budgetInfo = await computeDailyBudget(req.user!.id);
  if (!budgetInfo) {
    res.status(200).json({ weekPlan: null, reason: "Profil non configuré ou pas d'objectif calorique dans ce mode." });
    return;
  }
  const { targets, slotContext } = budgetInfo;

  const [recipes, fridgeItems] = await Promise.all([
    prisma.recipe.findMany({ include: { ingredients: true } }),
    prisma.fridgeItem.findMany({ where: { userId: req.user!.id, quantity: { gt: 0 } } }),
  ]);

  if (recipes.length === 0) {
    res.status(200).json({ weekPlan: null, reason: "Aucune recette disponible pour l'instant." });
    return;
  }

  const excludeParam = typeof req.query.exclude === "string" ? req.query.exclude : "";
  const excludeIds = new Set(excludeParam.split(",").filter(Boolean));

  const dailyTargets = {
    calories: targets.targetCalories,
    protein: targets.targetProteinG,
    fat: targets.targetFatG,
    carbs: targets.targetCarbsG,
  };

  const weekPlan = generateWeekPlan(recipes, fridgeItems, dailyTargets, targets, slotContext, tomorrowMidnight(), excludeIds);

  res.status(200).json({ weekPlan });
});

// Régénère un sous-ensemble ciblé du planning (un seul repas, ou tous les
// repas d'un jour) sans toucher au reste : le front renvoie l'intégralité
// des assignations qu'il veut GARDER telles quelles (`pinned`) — tout
// créneau absent de cette liste est recalculé. Régénérer "un repas" ou
// "un jour" utilise donc exactement le même mécanisme, seul le nombre de
// créneaux épinglés diffère (20 pour un repas, 18 pour un jour).
weekPlanRouter.post("/regenerate", requireAuth, async (req, res) => {
  const budgetInfo = await computeDailyBudget(req.user!.id);
  if (!budgetInfo) {
    res.status(200).json({ weekPlan: null, reason: "Profil non configuré ou pas d'objectif calorique dans ce mode." });
    return;
  }
  const { targets, slotContext } = budgetInfo;

  const body = req.body ?? {};
  if (!Array.isArray(body.pinned)) {
    res.status(400).json({ error: "Liste d'assignations épinglées requise (pinned)." });
    return;
  }

  const pinnedAssignments = new Map<string, string>();
  for (const entry of body.pinned) {
    if (
      entry &&
      typeof entry === "object" &&
      isNonEmptyString(entry.date) &&
      isMealSlot(entry.slot) &&
      isNonEmptyString(entry.recipeId)
    ) {
      pinnedAssignments.set(`${entry.date}|${entry.slot}`, entry.recipeId);
    }
  }

  const excludeIds = new Set<string>(
    Array.isArray(body.exclude) ? body.exclude.filter((x: unknown): x is string => typeof x === "string") : []
  );

  const [recipes, fridgeItems] = await Promise.all([
    prisma.recipe.findMany({ include: { ingredients: true } }),
    prisma.fridgeItem.findMany({ where: { userId: req.user!.id, quantity: { gt: 0 } } }),
  ]);

  if (recipes.length === 0) {
    res.status(200).json({ weekPlan: null, reason: "Aucune recette disponible pour l'instant." });
    return;
  }

  const dailyTargets = {
    calories: targets.targetCalories,
    protein: targets.targetProteinG,
    fat: targets.targetFatG,
    carbs: targets.targetCarbsG,
  };

  const weekPlan = generateWeekPlan(
    recipes,
    fridgeItems,
    dailyTargets,
    targets,
    slotContext,
    tomorrowMidnight(),
    excludeIds,
    pinnedAssignments
  );

  res.status(200).json({ weekPlan });
});
