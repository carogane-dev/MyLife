import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { computeDailyBudget } from "../dailyBudget.js";
import { generateWeekPlan } from "../weekPlanner.js";

export const weekPlanRouter = Router();

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

  const dailyTargets = { protein: targets.targetProteinG, fat: targets.targetFatG, carbs: targets.targetCarbsG };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const weekPlan = generateWeekPlan(recipes, fridgeItems, dailyTargets, targets, slotContext, tomorrow, excludeIds);

  res.status(200).json({ weekPlan });
});
