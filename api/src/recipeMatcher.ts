import { computeFloor, maxGramsForBudget, subtractFromBudget } from "./mealBudgetMath.js";
import type { MacroBudget } from "./mealBudgetMath.js";
import type { MealSlot } from "./mealSlots.js";

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
  compatibleSlots: string[];
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
  grams: number;
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
  // true si l'utilisateur a accepté cette recette nettement plus souvent
  // qu'il ne l'a refusée (voir computeAffinityScores) — sert uniquement à
  // l'affichage (badge "souvent accepté"), n'influence pas fitScore
  // au-delà de la pénalité/bonus déjà appliquée.
  liked: boolean;
}

// Bornes AMDR (Institute of Medicine) pour la part de chaque macro dans les
// calories d'UN repas — voir NutritionBenchmark en base, chargées via
// SlotContext.benchmark. Simplification assumée : les mêmes bornes
// journalières sont appliquées repas par repas (pas de repère scientifique
// distinct par repas trouvé), pratique courante en coaching nutritionnel.
export interface MacroRatioBounds {
  carbPercentMin: number;
  carbPercentMax: number;
  fatPercentMin: number;
  fatPercentMax: number;
  proteinPercentMin: number;
  proteinPercentMax: number;
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

// Ramène les quantités de la recette à UNE portion : `referenceGrams`/
// `displayQuantity` sont saisis pour la recette entière (`servings`
// portions, cf. routes/recipes.ts computeRecipeMacros qui divise déjà par
// servings pour l'affichage "par portion"). matchRecipeToBudget composait
// jusqu'ici un repas pour UNE personne à partir des quantités du LOT
// ENTIER — une recette à servings=8 (ex. des energy balls) produisait donc
// un total ~8× trop élevé dès qu'elle était choisie. Toutes les quantités
// utilisées par la suite (socle fixe, plafond de bon sens des ingrédients
// libres, grammes stockés pour la liste de courses/couverture stock)
// doivent partir de cette base par portion.
function toPerServingIngredients(recipe: RecipeInput): RecipeIngredientInput[] {
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  return recipe.ingredients.map((i) => ({
    ...i,
    referenceGrams: i.referenceGrams / servings,
    displayQuantity: i.displayQuantity / servings,
  }));
}

// Calories atteignables par UNE portion de cette recette : minimum = socle
// fixe seul (les ingrédients libres peuvent descendre à 0), maximum = socle
// fixe + ingrédients libres poussés à leur plafond de bon sens (3× leur
// quantité de référence, même règle que matchRecipeToBudget). Sert à
// écarter en amont les recettes structurellement incapables d'approcher le
// budget d'un créneau (ex. une recette à 0 ingrédient libre et un plafond
// dur très bas ne devrait jamais être LA proposition d'un repas copieux),
// plutôt que de compter uniquement sur la pénalité a posteriori du
// fitScore une fois la recette déjà choisie.
export interface RecipeCapacity {
  minCalories: number;
  maxCalories: number;
}

export function estimateRecipeCapacity(recipe: RecipeInput): RecipeCapacity {
  const perServing = toPerServingIngredients(recipe);
  let minCalories = 0;
  let maxCalories = 0;
  for (const i of perServing) {
    const caloriesPerGram = i.caloriesPer100g / 100;
    if (i.flexible) {
      maxCalories += i.referenceGrams * 3 * caloriesPerGram;
    } else {
      minCalories += i.referenceGrams * caloriesPerGram;
      maxCalories += i.referenceGrams * caloriesPerGram;
    }
  }
  return { minCalories, maxCalories };
}

// Écarte les recettes dont la capacité (voir estimateRecipeCapacity) est
// trop éloignée du budget calorique visé — trop basse pour l'approcher même
// en poussant les ingrédients libres au maximum, ou déjà trop élevée rien
// qu'avec le socle fixe (qui ne peut pas être réduit). Seuils arbitraires,
// choisis larges pour rester permissifs : 50% et 160% du budget. Si le
// filtrage ne laisse plus aucun candidat (créneau/pool trop contraint),
// retombe sur la liste complète plutôt que de ne rien proposer.
const MIN_CAPACITY_RATIO = 0.5;
const MAX_FLOOR_OVERSHOOT_RATIO = 1.6;

export function filterByCapacity<T extends RecipeInput>(candidates: T[], targetCalories: number): T[] {
  if (targetCalories <= 0) return candidates;
  const capable = candidates.filter((r) => {
    const { minCalories, maxCalories } = estimateRecipeCapacity(r);
    return maxCalories >= targetCalories * MIN_CAPACITY_RATIO && minCalories <= targetCalories * MAX_FLOOR_OVERSHOOT_RATIO;
  });
  return capable.length > 0 ? capable : candidates;
}

// Pénalité ajoutée au fitScore quand la répartition macro réalisée
// (protéines/lipides/glucides en % des calories) sort des bornes AMDR —
// évite qu'un repas dominé par un seul ingrédient libre très sucré/gras
// gagne le score malgré un ratio scientifiquement déraisonnable, même si
// ses grammes/calories bruts collent bien au budget. 0 si dans les bornes.
export function ratioPenalty(totals: MacroAmounts, bounds: MacroRatioBounds): number {
  if (totals.calories <= 0) return 0;
  const proteinPct = (totals.protein * 4) / totals.calories;
  const fatPct = (totals.fat * 9) / totals.calories;
  const carbsPct = (totals.carbs * 4) / totals.calories;
  const outOfBounds = (value: number, min: number, max: number) => Math.max(0, min - value, value - max);
  return (
    outOfBounds(proteinPct, bounds.proteinPercentMin, bounds.proteinPercentMax) +
    outOfBounds(fatPct, bounds.fatPercentMin, bounds.fatPercentMax) +
    outOfBounds(carbsPct, bounds.carbPercentMin, bounds.carbPercentMax)
  );
}

// Apprentissage des goûts : agrège l'historique accepter/refuser d'un
// utilisateur (RecipeDecision) par recette en un score dans ~[-1, 1] — 0 si
// aucune décision. Le lissage (+2 au dénominateur) amortit un score à
// faible échantillon : un unique refus ne fait pas chuter le score à -1.
// Simplification assumée : toutes les décisions comptent pareil, pas de
// pondération par récence (pas de repère scientifique là-dessus, juste un
// choix produit pour rester simple et explicable).
export interface RecipeAffinity {
  score: number;
  totalDecisions: number;
}
export type RecipeAffinityMap = Map<string, RecipeAffinity>;

const AFFINITY_SMOOTHING = 2;
const AFFINITY_WEIGHT = 0.3;
const AFFINITY_LIKED_MIN_DECISIONS = 3;
const AFFINITY_LIKED_THRESHOLD = 0.3;

export function computeAffinityScores(decisions: { recipeId: string; accepted: boolean }[]): RecipeAffinityMap {
  const counts = new Map<string, { accepts: number; rejects: number }>();
  for (const d of decisions) {
    const c = counts.get(d.recipeId) ?? { accepts: 0, rejects: 0 };
    if (d.accepted) c.accepts += 1;
    else c.rejects += 1;
    counts.set(d.recipeId, c);
  }
  const scores: RecipeAffinityMap = new Map();
  for (const [recipeId, { accepts, rejects }] of counts) {
    scores.set(recipeId, {
      score: (accepts - rejects) / (accepts + rejects + AFFINITY_SMOOTHING),
      totalDecisions: accepts + rejects,
    });
  }
  return scores;
}

function isLiked(affinity: RecipeAffinity | undefined): boolean {
  return !!affinity && affinity.totalDecisions >= AFFINITY_LIKED_MIN_DECISIONS && affinity.score > AFFINITY_LIKED_THRESHOLD;
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

// Adapte une recette à un budget de repas donné : les ingrédients "libres"
// sont redimensionnés (en plus ou en moins) pour coller au mieux au
// budget ; les ingrédients non-libres restent à leur quantité de référence
// (le "socle" de la recette n'est jamais déformé).
export function matchRecipeToBudget(
  recipe: RecipeInput,
  mealBudget: MacroAmounts,
  dailyTargets: { calories: number; protein: number; fat: number; carbs: number },
  ratioBounds?: MacroRatioBounds,
  affinityScores?: RecipeAffinityMap
): RecipeMatch {
  const floor: MacroBudget = computeFloor(dailyTargets);

  const perServing = toPerServingIngredients(recipe);
  const fixed = perServing.filter((i) => !i.flexible);
  const flexible = perServing.filter((i) => i.flexible);

  const matched: MatchedIngredient[] = fixed.map((i) => {
    const m = macrosFor(i, i.referenceGrams);
    return {
      name: i.name,
      displayQuantity: i.displayQuantity,
      displayUnit: i.displayUnit,
      flexible: false,
      grams: i.referenceGrams,
      ...m,
    };
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
    calories: Math.max(mealBudget.calories - fixedTotals.calories, floor.calories),
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
      grams: roundedGrams,
      ...m,
    });
    budget = subtractFromBudget(budget, m, floor);
  }

  const rawTotals = matched.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      fat: acc.fat + i.fat,
      carbs: acc.carbs + i.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
  // Arrondi après somme : chaque ingrédient est déjà arrondi individuellement
  // (macrosFor), mais additionner plusieurs valeurs à 1 décimale en flottant
  // JS produit des artefacts type 127.80000000000001 — invisible tant que
  // seul totals.calories (entier) était affiché, mais exposé dès qu'un
  // écran affiche aussi protein/fat/carbs (revue du planning).
  const totals = {
    calories: Math.round(rawTotals.calories),
    protein: Math.round(rawTotals.protein * 10) / 10,
    fat: Math.round(rawTotals.fat * 10) / 10,
    carbs: Math.round(rawTotals.carbs * 10) / 10,
  };

  const affinity = affinityScores?.get(recipe.id);
  const deviation = (value: number, target: number) => (target > 0 ? Math.abs(value - target) / target : 0);
  const fitScore =
    deviation(totals.calories, mealBudget.calories) +
    deviation(totals.protein, mealBudget.protein) +
    deviation(totals.fat, mealBudget.fat) +
    deviation(totals.carbs, mealBudget.carbs) +
    (ratioBounds ? ratioPenalty(totals, ratioBounds) : 0) -
    (affinity ? affinity.score * AFFINITY_WEIGHT : 0);

  return { recipeId: recipe.id, recipeName: recipe.name, ingredients: matched, totals, fitScore, liked: isLiked(affinity) };
}

// Essaie toutes les recettes compatibles avec ce créneau et retourne celle
// qui, une fois ses ingrédients libres ajustés, colle le mieux au budget du
// repas. matchRecipeToBudget elle-même ignore le créneau : seul ce filtre
// en amont en tient compte.
export function findBestRecipeMatch(
  recipes: RecipeInput[],
  mealBudget: MacroAmounts,
  dailyTargets: { calories: number; protein: number; fat: number; carbs: number },
  slot: MealSlot,
  excludeIds: Set<string> = new Set(),
  ratioBounds?: MacroRatioBounds,
  affinityScores?: RecipeAffinityMap
): RecipeMatch | null {
  const candidates = recipes.filter(
    (r) => !excludeIds.has(r.id) && r.ingredients.length > 0 && r.compatibleSlots.includes(slot)
  );
  if (candidates.length === 0) return null;

  const capable = filterByCapacity(candidates, mealBudget.calories);
  const matches = capable.map((r) => matchRecipeToBudget(r, mealBudget, dailyTargets, ratioBounds, affinityScores));
  matches.sort((a, b) => a.fitScore - b.fitScore);
  return matches[0];
}
