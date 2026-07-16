import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { isFiniteNumber, isNonEmptyString } from "../validation.js";

export const profileRouter = Router();

const SEX_VALUES = ["homme", "femme"];
const ACTIVITY_LEVELS = ["sedentaire", "leger", "modere", "actif", "tres_actif"];

profileRouter.get("/", requireAuth, async (req, res) => {
  const profile = await prisma.nutritionProfile.findUnique({
    where: { userId: req.user!.id },
  });
  res.status(200).json({ profile });
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
    !ACTIVITY_LEVELS.includes(body.activityLevel)
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
  };

  const profile = await prisma.nutritionProfile.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, ...data },
    update: data,
  });

  res.status(200).json({ profile });
});
