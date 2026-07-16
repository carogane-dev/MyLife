import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { fetchOffProduct, OffLookupError } from "../offClient.js";
import { deriveCategory } from "../categoryMapping.js";
import { resolveNutrition } from "../nutritionDefaults.js";
import { isFiniteNumber, isNonEmptyString, isValidDateString } from "../validation.js";

export const fridgeRouter = Router();

const BARCODE_RE = /^\d{8,14}$/;

function isValidFridgeItemBody(body: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(body.name) &&
    isFiniteNumber(body.quantity) &&
    (body.quantity as number) > 0 &&
    isNonEmptyString(body.unit) &&
    isNonEmptyString(body.category) &&
    isNonEmptyString(body.subcategory) &&
    isValidDateString(body.expiresAt) &&
    isFiniteNumber(body.caloriesPer100g) &&
    isFiniteNumber(body.proteinPer100g) &&
    isFiniteNumber(body.fatPer100g) &&
    isFiniteNumber(body.carbsPer100g)
  );
}

fridgeRouter.get("/", requireAuth, async (req, res) => {
  const items = await prisma.fridgeItem.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ category: "asc" }, { subcategory: "asc" }, { name: "asc" }],
  });
  res.status(200).json({ items });
});

fridgeRouter.get("/lookup/:barcode", requireAuth, async (req, res) => {
  const { barcode } = req.params;
  if (!BARCODE_RE.test(barcode)) {
    res.status(400).json({ error: "Code-barres invalide." });
    return;
  }

  let product;
  try {
    product = await fetchOffProduct(barcode);
  } catch (err) {
    if (err instanceof OffLookupError) {
      res.status(502).json({ error: "Impossible de contacter la base de données des produits, réessaie." });
      return;
    }
    throw err;
  }

  if (!product) {
    res.status(404).json({ error: "Produit introuvable, essaie un autre article." });
    return;
  }

  const { category, subcategory, nutritionBucket } = deriveCategory(product);
  const nutrition = resolveNutrition(product.nutriments, nutritionBucket);

  res.status(200).json({
    item: {
      barcode,
      name: product.productName ?? "Produit sans nom",
      category,
      subcategory,
      quantity: product.quantityGrams ?? 1,
      unit: product.quantityGrams !== null ? "g" : "pièce",
      // Jamais fournie par Open Food Facts (dépend du lot physique) :
      // l'utilisateur doit la renseigner lui-même avant de pouvoir valider.
      expiresAt: null,
      ...nutrition,
    },
  });
});

fridgeRouter.post("/", requireAuth, async (req, res) => {
  const body = req.body ?? {};

  if (!isValidFridgeItemBody(body)) {
    res.status(400).json({ error: "Nom, quantité, unité et date de péremption requis." });
    return;
  }

  const item = await prisma.fridgeItem.create({
    data: {
      userId: req.user!.id,
      name: body.name.trim(),
      category: body.category,
      subcategory: body.subcategory,
      expiresAt: new Date(body.expiresAt),
      quantity: body.quantity,
      unit: body.unit,
      barcode: isNonEmptyString(body.barcode) ? body.barcode : null,
      caloriesPer100g: body.caloriesPer100g,
      proteinPer100g: body.proteinPer100g,
      fatPer100g: body.fatPer100g,
      carbsPer100g: body.carbsPer100g,
      nutritionEstimated: body.nutritionEstimated === true,
    },
  });

  res.status(201).json({ item });
});

fridgeRouter.put("/:id", requireAuth, async (req, res) => {
  const body = req.body ?? {};

  if (!isValidFridgeItemBody(body)) {
    res.status(400).json({ error: "Nom, quantité, unité et date de péremption requis." });
    return;
  }

  const existing = await prisma.fridgeItem.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!existing) {
    res.status(404).json({ error: "Article introuvable." });
    return;
  }

  const item = await prisma.fridgeItem.update({
    where: { id: existing.id },
    data: {
      name: body.name.trim(),
      category: body.category,
      subcategory: body.subcategory,
      expiresAt: new Date(body.expiresAt),
      quantity: body.quantity,
      unit: body.unit,
      barcode: isNonEmptyString(body.barcode) ? body.barcode : null,
      caloriesPer100g: body.caloriesPer100g,
      proteinPer100g: body.proteinPer100g,
      fatPer100g: body.fatPer100g,
      carbsPer100g: body.carbsPer100g,
      nutritionEstimated: body.nutritionEstimated === true,
    },
  });

  res.status(200).json({ item });
});

fridgeRouter.delete("/:id", requireAuth, async (req, res) => {
  const existing = await prisma.fridgeItem.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!existing) {
    res.status(404).json({ error: "Article introuvable." });
    return;
  }

  await prisma.fridgeItem.delete({ where: { id: existing.id } });
  res.status(204).end();
});
