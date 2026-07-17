import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { isFiniteNumber, isNonEmptyString } from "../validation.js";
import { computeDailyBudget, computeMealBudget, isDayComplete, parseMealsRemaining } from "../dailyBudget.js";
import { findBestRecipeMatch } from "../recipeMatcher.js";

export const recipesRouter = Router();

const CATEGORIES = ["Petit-déjeuner", "Plat", "Entrée", "Dessert", "Snack"];
const DIFFICULTIES = ["facile", "moyen", "difficile"];

interface IngredientInput {
  name: string;
  displayQuantity: number;
  displayUnit: string;
  referenceGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  flexible: boolean;
}

function isValidIngredient(i: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(i.name) &&
    isFiniteNumber(i.displayQuantity) &&
    (i.displayQuantity as number) > 0 &&
    isNonEmptyString(i.displayUnit) &&
    isFiniteNumber(i.referenceGrams) &&
    (i.referenceGrams as number) > 0 &&
    isFiniteNumber(i.caloriesPer100g) &&
    isFiniteNumber(i.proteinPer100g) &&
    isFiniteNumber(i.fatPer100g) &&
    isFiniteNumber(i.carbsPer100g) &&
    typeof i.flexible === "boolean"
  );
}

function isValidRecipeBody(body: Record<string, unknown>): boolean {
  if (
    !isNonEmptyString(body.name) ||
    !isNonEmptyString(body.instructions) ||
    !isNonEmptyString(body.category) ||
    !CATEGORIES.includes(body.category as string) ||
    !isNonEmptyString(body.difficulty) ||
    !DIFFICULTIES.includes(body.difficulty as string) ||
    !isFiniteNumber(body.prepMinutes) ||
    (body.prepMinutes as number) < 0 ||
    !isFiniteNumber(body.cookMinutes) ||
    (body.cookMinutes as number) < 0 ||
    !isFiniteNumber(body.servings) ||
    (body.servings as number) <= 0 ||
    typeof body.healthy !== "boolean" ||
    !Array.isArray(body.ingredients) ||
    body.ingredients.length === 0
  ) {
    return false;
  }
  return (body.ingredients as Record<string, unknown>[]).every(isValidIngredient);
}

// Macros totales de la recette telle que décrite (quantités de référence,
// avant tout ajustement par le composeur de repas), et par portion.
function computeRecipeMacros(ingredients: IngredientInput[], servings: number) {
  const totals = ingredients.reduce(
    (acc, i) => {
      const ratio = i.referenceGrams / 100;
      return {
        calories: acc.calories + i.caloriesPer100g * ratio,
        protein: acc.protein + i.proteinPer100g * ratio,
        fat: acc.fat + i.fatPer100g * ratio,
        carbs: acc.carbs + i.carbsPer100g * ratio,
      };
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
  return {
    total: {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
    },
    perServing: {
      calories: Math.round(totals.calories / servings),
      protein: Math.round((totals.protein / servings) * 10) / 10,
      fat: Math.round((totals.fat / servings) * 10) / 10,
      carbs: Math.round((totals.carbs / servings) * 10) / 10,
    },
  };
}

type SortOption = "likes" | "time" | "recent";

recipesRouter.get("/", requireAuth, async (req, res) => {
  const { q, category, healthy, difficulty, ingredient, sort } = req.query;

  const where: Record<string, unknown> = {};
  if (isNonEmptyString(category)) where.category = category;
  if (isNonEmptyString(difficulty)) where.difficulty = difficulty;
  if (healthy === "true") where.healthy = true;
  if (healthy === "false") where.healthy = false;
  if (isNonEmptyString(q)) where.name = { contains: q, mode: "insensitive" };
  if (isNonEmptyString(ingredient)) {
    where.ingredients = { some: { name: { contains: ingredient, mode: "insensitive" } } };
  }

  const recipes = await prisma.recipe.findMany({
    where,
    include: { ingredients: true, likes: true },
  });

  const sortOption: SortOption = sort === "likes" || sort === "time" ? sort : "recent";

  const enriched = recipes.map((r) => {
    const { perServing } = computeRecipeMacros(r.ingredients as unknown as IngredientInput[], r.servings);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      healthy: r.healthy,
      difficulty: r.difficulty,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      totalMinutes: r.prepMinutes + r.cookMinutes,
      servings: r.servings,
      ingredientCount: r.ingredients.length,
      likeCount: r.likes.length,
      likedByMe: r.likes.some((l) => l.userId === req.user!.id),
      macrosPerServing: perServing,
      createdAt: r.createdAt,
    };
  });

  enriched.sort((a, b) => {
    if (sortOption === "likes") return b.likeCount - a.likeCount;
    if (sortOption === "time") return a.totalMinutes - b.totalMinutes;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  res.status(200).json({ recipes: enriched });
});

// Suggère la recette de la communauté qui, une fois ses ingrédients
// "libres" ajustés, colle le mieux à ce qu'il reste à atteindre pour ce
// repas — placé avant "/:id" pour ne pas être intercepté par cette route.
recipesRouter.get("/suggestion/for-meal", requireAuth, async (req, res) => {
  const budgetInfo = await computeDailyBudget(req.user!.id);
  if (!budgetInfo) {
    res.status(200).json({ match: null, reason: "Profil non configuré ou pas d'objectif calorique dans ce mode." });
    return;
  }
  const { targets, remaining } = budgetInfo;

  if (isDayComplete(remaining, targets)) {
    res.status(200).json({ match: null, reason: "Objectif du jour déjà atteint sur toutes les macros 🎉" });
    return;
  }

  const recipes = await prisma.recipe.findMany({ include: { ingredients: true } });
  if (recipes.length === 0) {
    res.status(200).json({ match: null, reason: "Aucune recette disponible pour l'instant." });
    return;
  }

  const excludeParam = typeof req.query.exclude === "string" ? req.query.exclude : "";
  const excludeIds = new Set(excludeParam.split(",").filter(Boolean));
  const mealsRemaining = parseMealsRemaining(req.query.meals);
  const dailyTargets = { protein: targets.targetProteinG, fat: targets.targetFatG, carbs: targets.targetCarbsG };
  const mealBudget = computeMealBudget(remaining, targets, mealsRemaining);

  const match = findBestRecipeMatch(recipes, mealBudget, dailyTargets, excludeIds);

  if (!match) {
    res.status(200).json({ match: null, reason: "Aucune recette ne correspond pour l'instant." });
    return;
  }

  res.status(200).json({ match });
});

recipesRouter.get("/:id", requireAuth, async (req, res) => {
  const recipe = await prisma.recipe.findUnique({
    where: { id: req.params.id },
    include: { ingredients: { orderBy: { order: "asc" } }, likes: true, author: { select: { email: true } } },
  });
  if (!recipe) {
    res.status(404).json({ error: "Recette introuvable." });
    return;
  }

  const { total, perServing } = computeRecipeMacros(recipe.ingredients as unknown as IngredientInput[], recipe.servings);

  res.status(200).json({
    recipe: {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      instructions: recipe.instructions,
      category: recipe.category,
      healthy: recipe.healthy,
      difficulty: recipe.difficulty,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
      servings: recipe.servings,
      authorEmail: recipe.author.email,
      isAuthor: recipe.authorId === req.user!.id,
      ingredients: recipe.ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        displayQuantity: i.displayQuantity,
        displayUnit: i.displayUnit,
        referenceGrams: i.referenceGrams,
        caloriesPer100g: i.caloriesPer100g,
        proteinPer100g: i.proteinPer100g,
        fatPer100g: i.fatPer100g,
        carbsPer100g: i.carbsPer100g,
        flexible: i.flexible,
      })),
      likeCount: recipe.likes.length,
      likedByMe: recipe.likes.some((l) => l.userId === req.user!.id),
      macrosTotal: total,
      macrosPerServing: perServing,
    },
  });
});

recipesRouter.post("/", requireAuth, async (req, res) => {
  const body = req.body ?? {};
  if (!isValidRecipeBody(body)) {
    res.status(400).json({ error: "Recette invalide : vérifie les champs et la liste d'ingrédients." });
    return;
  }

  const ingredients = body.ingredients as IngredientInput[];
  const recipe = await prisma.recipe.create({
    data: {
      authorId: req.user!.id,
      name: body.name,
      description: isNonEmptyString(body.description) ? body.description : null,
      instructions: body.instructions,
      category: body.category,
      healthy: body.healthy,
      difficulty: body.difficulty,
      prepMinutes: body.prepMinutes,
      cookMinutes: body.cookMinutes,
      servings: body.servings,
      ingredients: {
        create: ingredients.map((i, index) => ({
          name: i.name,
          displayQuantity: i.displayQuantity,
          displayUnit: i.displayUnit,
          referenceGrams: i.referenceGrams,
          caloriesPer100g: i.caloriesPer100g,
          proteinPer100g: i.proteinPer100g,
          fatPer100g: i.fatPer100g,
          carbsPer100g: i.carbsPer100g,
          flexible: i.flexible,
          order: index,
        })),
      },
    },
  });

  res.status(201).json({ recipe: { id: recipe.id } });
});

recipesRouter.put("/:id", requireAuth, async (req, res) => {
  const body = req.body ?? {};
  if (!isValidRecipeBody(body)) {
    res.status(400).json({ error: "Recette invalide : vérifie les champs et la liste d'ingrédients." });
    return;
  }

  const existing = await prisma.recipe.findFirst({ where: { id: req.params.id, authorId: req.user!.id } });
  if (!existing) {
    res.status(404).json({ error: "Recette introuvable." });
    return;
  }

  const ingredients = body.ingredients as IngredientInput[];
  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: existing.id } }),
    prisma.recipe.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        description: isNonEmptyString(body.description) ? body.description : null,
        instructions: body.instructions,
        category: body.category,
        healthy: body.healthy,
        difficulty: body.difficulty,
        prepMinutes: body.prepMinutes,
        cookMinutes: body.cookMinutes,
        servings: body.servings,
        ingredients: {
          create: ingredients.map((i, index) => ({
            name: i.name,
            displayQuantity: i.displayQuantity,
            displayUnit: i.displayUnit,
            referenceGrams: i.referenceGrams,
            caloriesPer100g: i.caloriesPer100g,
            proteinPer100g: i.proteinPer100g,
            fatPer100g: i.fatPer100g,
            carbsPer100g: i.carbsPer100g,
            flexible: i.flexible,
            order: index,
          })),
        },
      },
    }),
  ]);

  res.status(200).json({ recipe: { id: existing.id } });
});

recipesRouter.delete("/:id", requireAuth, async (req, res) => {
  const existing = await prisma.recipe.findFirst({ where: { id: req.params.id, authorId: req.user!.id } });
  if (!existing) {
    res.status(404).json({ error: "Recette introuvable." });
    return;
  }
  await prisma.recipe.delete({ where: { id: existing.id } });
  res.status(204).end();
});

recipesRouter.post("/:id/like", requireAuth, async (req, res) => {
  const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id } });
  if (!recipe) {
    res.status(404).json({ error: "Recette introuvable." });
    return;
  }

  const existingLike = await prisma.recipeLike.findUnique({
    where: { userId_recipeId: { userId: req.user!.id, recipeId: recipe.id } },
  });

  if (existingLike) {
    await prisma.recipeLike.delete({ where: { id: existingLike.id } });
  } else {
    await prisma.recipeLike.create({ data: { userId: req.user!.id, recipeId: recipe.id } });
  }

  const likeCount = await prisma.recipeLike.count({ where: { recipeId: recipe.id } });
  res.status(200).json({ liked: !existingLike, likeCount });
});
