import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { loadModeConfigs } from "../dailyBudget.js";
import { prisma } from "../db.js";

export const nutritionConfigRouter = Router();

// Expose la config nutritionnelle (modes/morphologies + repères
// scientifiques) au front, pour que calculateNutritionTargets côté client
// (miroir de la version backend) utilise les mêmes valeurs sans les
// dupliquer en dur. Utilisée aussi pour le disclaimer affiché avec les
// objectifs calculés.
nutritionConfigRouter.get("/", requireAuth, async (_req, res) => {
  const [modeConfigs, benchmark] = await Promise.all([loadModeConfigs(), prisma.nutritionBenchmark.findFirst()]);
  res.status(200).json({ modeConfigs, benchmark });
});
