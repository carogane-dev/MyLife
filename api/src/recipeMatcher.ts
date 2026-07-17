export interface RecipeIngredientInput {
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

export interface RecipeInput {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredientInput[];
}

export interface MacroAmounts {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface MatchedIngredient {
  name: string;
  displayQuantity: number;
  displayUnit: string;
  flexible: boolean;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface RecipeMatch {
  recipeId: string;
  recipeName: string;
  ingredients: MatchedIngredient[];
  totals: MacroAmounts;
  // Somme des écarts relatifs aux 3 macros par rapport au budget du repas :
  // 0 = ajustement parfait, plus c'est élevé, moins la recette convient.
  fitScore: number;
}

interface MacroBudget {
  protein: number;
  fat: number;
  carbs: number;
}

function macrosFor(ingredient: RecipeIngredientInput, grams: number): MacroAmounts {
  const ratio = grams / 100;
  return {
    calories: Math.round(ingredient.caloriesPer100g * ratio),
    protein: Math.round(ingredient.proteinPer100g * ratio * 10) / 10,
    fat: Math.round(ingredient.fatPer100g * ratio * 10) / 10,
    carbs: Math.round(ingredient.carbsPer100g * ratio * 10) / 10,
  };
}

// Macro que cet ingrédient apporte le plus (en calories), utilisée pour
// décider quelle part du budget restant il doit combler en priorité.
function dominantMacro(ingredient: RecipeIngredientInput): "protein" | "fat" | "carbs" {
  const proteinCal = ingredient.proteinPer100g * 4;
  const fatCal = ingredient.fatPer100g * 9;
  const carbsCal = ingredient.carbsPer100g * 4;
  if (proteinCal >= fatCal && proteinCal >= carbsCal) return "protein";
  if (fatCal >= carbsCal) return "fat";
  return "carbs";
}

// Mêmes principes que api/src/mealBuilder.ts : plafonne un ingrédient par
// le budget macro du repas sur les dimensions encore "actives" (celles pas
// déjà tombées à leur plancher), pour éviter qu'un ingrédient gras ne fasse
// exploser le budget lipides même choisi pour ses glucides par exemple.
function maxGramsForBudget(ingredient: RecipeIngredientInput, budget: MacroBudget, floor: MacroBudget): number {
  let max = Infinity;
  if (ingredient.proteinPer100g > 0 && budget.protein > floor.protein * 1.01) {
    max = Math.min(max, (budget.protein / ingredient.proteinPer100g) * 100);
  }
  if (ingredient.fatPer100g > 0 && budget.fat > floor.fat * 1.01) {
    max = Math.min(max, (budget.fat / ingredient.fatPer100g) * 100);
  }
  if (ingredient.carbsPer100g > 0 && budget.carbs > floor.carbs * 1.01) {
    max = Math.min(max, (budget.carbs / ingredient.carbsPer100g) * 100);
  }
  return Math.max(0, max);
}

function subtractFromBudget(budget: MacroBudget, macros: MacroAmounts, floor: MacroBudget): MacroBudget {
  return {
    protein: Math.max(floor.protein, budget.protein - macros.protein),
    fat: Math.max(floor.fat, budget.fat - macros.fat),
    carbs: Math.max(floor.carbs, budget.carbs - macros.carbs),
  };
}

// Adapte une recette à un budget de repas donné : les ingrédients "libres"
// sont redimensionnés (en plus ou en moins) pour coller au mieux au
// budget ; les ingrédients non-libres restent à leur quantité de référence
// (le "socle" de la recette n'est jamais déformé).
export function matchRecipeToBudget(
  recipe: RecipeInput,
  mealBudget: MacroAmounts,
  dailyTargets: { protein: number; fat: number; carbs: number }
): RecipeMatch {
  const floor: MacroBudget = {
    protein: dailyTargets.protein * 0.03,
    fat: dailyTargets.fat * 0.03,
    carbs: dailyTargets.carbs * 0.03,
  };

  const fixed = recipe.ingredients.filter((i) => !i.flexible);
  const flexible = recipe.ingredients.filter((i) => i.flexible);

  const matched: MatchedIngredient[] = fixed.map((i) => {
    const m = macrosFor(i, i.referenceGrams);
    return { name: i.name, displayQuantity: i.displayQuantity, displayUnit: i.displayUnit, flexible: false, ...m };
  });

  const fixedTotals = matched.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      fat: acc.fat + i.fat,
      carbs: acc.carbs + i.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  let budget: MacroBudget = {
    protein: Math.max(mealBudget.protein - fixedTotals.protein, floor.protein),
    fat: Math.max(mealBudget.fat - fixedTotals.fat, floor.fat),
    carbs: Math.max(mealBudget.carbs - fixedTotals.carbs, floor.carbs),
  };

  // Priorise, à chaque étape, l'ingrédient libre dont la macro dominante
  // correspond au plus gros manque du budget restant.
  const remainingFlexible = [...flexible];
  while (remainingFlexible.length > 0) {
    remainingFlexible.sort((a, b) => budget[dominantMacro(b)] - budget[dominantMacro(a)]);
    const ing = remainingFlexible.shift()!;

    const dom = dominantMacro(ing);
    const per100 = dom === "protein" ? ing.proteinPer100g : dom === "fat" ? ing.fatPer100g : ing.carbsPer100g;
    const targetGrams = per100 > 0 ? (budget[dom] / per100) * 100 : ing.referenceGrams;
    const sanityCap = ing.referenceGrams * 3;
    const budgetCap = maxGramsForBudget(ing, budget, floor);
    const grams = Math.max(0, Math.min(targetGrams, sanityCap, budgetCap));
    if (grams <= 0) continue;

    const roundedGrams = Math.round(grams / 5) * 5;
    if (roundedGrams <= 0) continue;
    const factor = roundedGrams / ing.referenceGrams;
    const m = macrosFor(ing, roundedGrams);

    matched.push({
      name: ing.name,
      displayQuantity: Math.round(ing.displayQuantity * factor * 100) / 100,
      displayUnit: ing.displayUnit,
      flexible: true,
      ...m,
    });
    budget = subtractFromBudget(budget, m, floor);
  }

  const totals = matched.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      fat: acc.fat + i.fat,
      carbs: acc.carbs + i.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const deviation = (value: number, target: number) => (target > 0 ? Math.abs(value - target) / target : 0);
  const fitScore =
    deviation(totals.protein, mealBudget.protein) +
    deviation(totals.fat, mealBudget.fat) +
    deviation(totals.carbs, mealBudget.carbs);

  return { recipeId: recipe.id, recipeName: recipe.name, ingredients: matched, totals, fitScore };
}

// Essaie toutes les recettes disponibles et retourne celle qui, une fois
// ses ingrédients libres ajustés, colle le mieux au budget du repas.
export function findBestRecipeMatch(
  recipes: RecipeInput[],
  mealBudget: MacroAmounts,
  dailyTargets: { protein: number; fat: number; carbs: number },
  excludeIds: Set<string> = new Set()
): RecipeMatch | null {
  const candidates = recipes.filter((r) => !excludeIds.has(r.id) && r.ingredients.length > 0);
  if (candidates.length === 0) return null;

  const matches = candidates.map((r) => matchRecipeToBudget(r, mealBudget, dailyTargets));
  matches.sort((a, b) => a.fitScore - b.fitScore);
  return matches[0];
}
