import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { isFiniteNumber, isNonEmptyString } from "../validation.js";
import { calculateNutritionTargets } from "../nutritionCalculator.js";
import type { ActivityLevel, GoalMode, Sex } from "../nutritionCalculator.js";

export const profileRouter = Router();

const SEX_VALUES = ["homme", "femme", "autre"];
const ACTIVITY_LEVELS = ["sedentaire", "leger", "modere", "actif", "tres_actif"];
const GOAL_MODES = ["precision", "ligne", "frigo_only"];

profileRouter.get("/", requireAuth, async (req, res) => {
  const profile = await prisma.nutritionProfile.findUnique({
    where: { userId: req.user!.id },
  });
  const targets = profile
    ? calculateNutritionTargets({
        sex: profile.sex as Sex,
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        activityLevel: profile.activityLevel as ActivityLevel,
        goalMode: profile.goalMode as GoalMode,
      })
    : null;
  res.status(200).json({ profile, targets });
});

profileRouter.put("/", requireAuth, async (req, res) => {
  const body = req.body ?? {};

  if (
    !isNonEmptyString(body.sex) ||
    !SEX_VALUES.includes(body.sex) ||
    !isFiniteNumber(body.age) ||
    body.age < 13 ||
    body.age > 120 ||
    !isFiniteNumber(body.heightCm) ||
    body.heightCm < 100 ||
    body.heightCm > 250 ||
    !isFiniteNumber(body.weightKg) ||
    body.weightKg < 30 ||
    body.weightKg > 300 ||
    !isNonEmptyString(body.activityLevel) ||
    !ACTIVITY_LEVELS.includes(body.activityLevel) ||
    !isNonEmptyString(body.goalMode) ||
    !GOAL_MODES.includes(body.goalMode)
  ) {
    res.status(400).json({ error: "Profil invalide, vérifie les valeurs saisies." });
    return;
  }

  const data = {
    sex: body.sex,
    age: body.age,
    heightCm: body.heightCm,
    weightKg: body.weightKg,
    activityLevel: body.activityLevel,
    goalMode: body.goalMode,
  };

  const profile = await prisma.nutritionProfile.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, ...data },
    update: data,
  });

  const targets = calculateNutritionTargets({
    sex: profile.sex as Sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel as ActivityLevel,
    goalMode: profile.goalMode as GoalMode,
  });

  res.status(200).json({ profile, targets });
});
