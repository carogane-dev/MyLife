import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { isFiniteNumber, isNonEmptyString, isValidDateString } from "../validation.js";
import { quantityToGrams } from "../unitConversion.js";

export const consumptionRouter = Router();

consumptionRouter.post("/", requireAuth, async (req, res) => {
  const body = req.body ?? {};

  if (!isNonEmptyString(body.fridgeItemId) || !isFiniteNumber(body.quantity) || body.quantity <= 0) {
    res.status(400).json({ error: "Article et quantité mangée requis." });
    return;
  }

  const item = await prisma.fridgeItem.findFirst({
    where: { id: body.fridgeItemId, userId: req.user!.id },
  });
  if (!item) {
    res.status(404).json({ error: "Article introuvable." });
    return;
  }
  if (body.quantity > item.quantity) {
    res.status(400).json({ error: "Tu ne peux pas manger plus que la quantité restante." });
    return;
  }

  // Les macros sont toujours renseignées "pour 100g" (voir FridgeItem) : on
  // convertit d'abord la quantité consommée (dans l'unité de l'article,
  // ex. "pièce") en grammes avant d'appliquer le ratio.
  const gramsConsumed = quantityToGrams(body.quantity, item.unit, item.unitWeightGrams);
  const ratio = gramsConsumed / 100;
  const entry = await prisma.consumptionEntry.create({
    data: {
      userId: req.user!.id,
      fridgeItemId: item.id,
      name: item.name,
      quantity: body.quantity,
      unit: item.unit,
      calories: Math.round(item.caloriesPer100g * ratio),
      protein: Math.round(item.proteinPer100g * ratio * 10) / 10,
      fat: Math.round(item.fatPer100g * ratio * 10) / 10,
      carbs: Math.round(item.carbsPer100g * ratio * 10) / 10,
    },
  });

  const remaining = item.quantity - body.quantity;
  let itemDeleted = false;
  if (remaining <= 0) {
    await prisma.fridgeItem.delete({ where: { id: item.id } });
    itemDeleted = true;
  } else {
    await prisma.fridgeItem.update({ where: { id: item.id }, data: { quantity: remaining } });
  }

  res.status(201).json({ entry, itemDeleted });
});

consumptionRouter.get("/", requireAuth, async (req, res) => {
  const { from, to } = req.query;

  if (!isValidDateString(from) || !isValidDateString(to)) {
    res.status(400).json({ error: "Période invalide." });
    return;
  }

  const entries = await prisma.consumptionEntry.findMany({
    where: {
      userId: req.user!.id,
      consumedAt: { gte: new Date(from), lte: new Date(to) },
    },
    orderBy: { consumedAt: "desc" },
  });

  res.status(200).json({ entries });
});

// Outil de test : simule le passage à un nouveau jour en décalant les
// entrées d'aujourd'hui de 24h dans le passé, plutôt que de les supprimer —
// elles comptent alors pour "hier" (visibles dans le graphique de la
// semaine) et le compteur du jour repart à zéro, sans perdre l'historique.
consumptionRouter.post("/simulate-new-day", requireAuth, async (req, res) => {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const todayEntries = await prisma.consumptionEntry.findMany({
    where: { userId: req.user!.id, consumedAt: { gte: dayStart, lte: dayEnd } },
  });

  await Promise.all(
    todayEntries.map((entry) =>
      prisma.consumptionEntry.update({
        where: { id: entry.id },
        data: { consumedAt: new Date(entry.consumedAt.getTime() - 24 * 60 * 60 * 1000) },
      })
    )
  );

  res.status(200).json({ shifted: todayEntries.length });
});
