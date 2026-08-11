import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { isNonEmptyString } from "../validation.js";
import { recognizeDish, VisionRecognitionError } from "../visionClient.js";

export const mealsRouter = Router();

// Chaque appel a un coût réel (API de vision externe) — limite généreuse
// mais bornée pour éviter une facture qui s'emballe en cas de bug/abus.
const recognizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ recognized: false, reason: "Trop d'analyses récentes, réessaie plus tard." });
  },
});

// Historique des tentatives de reconnaissance (photo + résultat brut, pour
// audit) — le squelette précédent dans index.ts ne filtrait pas par
// utilisateur, corrigé ici.
mealsRouter.get("/", requireAuth, async (req, res) => {
  const meals = await prisma.mealEntry.findMany({
    where: { userId: req.user!.id },
    orderBy: { eatenAt: "desc" },
    take: 20,
  });
  res.status(200).json(meals);
});

// Envoie une photo (base64) au modèle de vision pour identifier le plat et
// estimer ses macros. Ne journalise jamais de repas automatiquement — le
// front doit toujours faire valider/corriger le résultat par l'utilisateur
// avant d'appeler /api/consumption/manual (logManualConsumption).
mealsRouter.post("/recognize", requireAuth, recognizeLimiter, async (req, res) => {
  const body = req.body ?? {};
  if (!isNonEmptyString(body.imageBase64) || !isNonEmptyString(body.mediaType)) {
    res.status(400).json({ recognized: false, reason: "Photo manquante ou invalide." });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({ recognized: false, reason: "Reconnaissance photo non configurée (clé API manquante)." });
    return;
  }

  try {
    const result = await recognizeDish(body.imageBase64, body.mediaType);

    const mealEntry = await prisma.mealEntry.create({
      data: {
        userId: req.user!.id,
        dishName: result.dishName || null,
        aiRawResult: { text: result.rawResponseText },
      },
    });

    res.status(200).json({
      recognized: true,
      mealEntryId: mealEntry.id,
      dishName: result.dishName,
      confidence: result.confidence,
      estimatedMacros: {
        calories: result.caloriesPerServing,
        protein: result.proteinG,
        fat: result.fatG,
        carbs: result.carbsG,
      },
      notes: result.notes,
    });
  } catch (err) {
    // Trace même l'échec : conforme au rôle "audit" déjà documenté du champ
    // aiRawResult sur MealEntry (voir schema.prisma).
    const message = err instanceof VisionRecognitionError ? err.message : "Erreur inattendue lors de la reconnaissance.";
    await prisma.mealEntry.create({
      data: { userId: req.user!.id, aiRawResult: { error: message } },
    });
    res.status(200).json({ recognized: false, reason: message });
  }
});
