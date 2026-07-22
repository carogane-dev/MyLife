import { filterByCapacity, matchRecipeToBudget } from "./recipeMatcher.js";
import type { MacroRatioBounds, RecipeAffinityMap, RecipeInput, RecipeMatch } from "./recipeMatcher.js";
import { MEAL_SLOTS, normalizedSlotShare } from "./mealSlots.js";
import type { MealSlot } from "./mealSlots.js";
import { computeFloor } from "./mealBudgetMath.js";
import type { MacroTargets } from "./mealBudgetMath.js";
import { quantityToGrams } from "./unitConversion.js";
import type { NutritionTargets } from "./nutritionCalculator.js";
import type { SlotContext } from "./dailyBudget.js";

export interface FridgeStockItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitWeightGrams: number | null;
}

export interface MissingIngredient {
  name: string;
  displayQuantity: number;
  displayUnit: string;
  grams: number;
}

export interface DaySlotAssignment {
  date: string; // ISO "YYYY-MM-DD"
  slot: MealSlot;
  match: RecipeMatch | null; // null si aucune recette compatible restante (pool épuisé par la variété)
  stockCovered: boolean;
  missingIngredients: MissingIngredient[];
}

export interface WeekPlanDay {
  date: string;
  slots: DaySlotAssignment[];
}

// Besoin agrégé sur les 21 repas pour un ingrédient donné, comparé au stock
// ACTUEL (pas la version progressivement décrémentée utilisée pour
// stockCovered par repas — ici on répond à "combien acheter au total pour
// couvrir toute la semaine", indépendamment de l'ordre dans lequel les
// repas seront réellement cuisinés). totalShortfallGrams diminue au fur et
// à mesure que du stock correspondant est ajouté au frigo, puisqu'il est
// recalculé à chaque appel à partir du stock réel.
export interface ShoppingListItem {
  name: string;
  totalNeededGrams: number;
  totalShortfallGrams: number;
}

export interface WeekPlan {
  days: WeekPlanDay[];
  coverage: { total: number; covered: number };
  shoppingList: ShoppingListItem[];
}

// Contrainte de variété : arbitraire, pas un repère scientifique — évite
// qu'une même recette sature le planning sans pour autant l'interdire
// totalement (le pool de 36 recettes reste petit).
const MAX_RECIPE_USES_PER_WEEK = 2;

// Pénalité douce de diversité : ajoutée au fitScore d'une recette déjà
// utilisée plus tôt dans la semaine, proportionnellement au nombre
// d'utilisations. Sans ça, le choix glouton par fitScore seul retombe
// presque toujours sur la même poignée de recettes "les mieux ajustées"
// dès qu'un budget de créneau se ressemble d'un jour à l'autre — la
// contrainte dure (MAX_RECIPE_USES_PER_WEEK) n'empêche pas ça, elle ne
// fait qu'interdire le cas extrême. Valeur arbitraire : assez forte pour
// qu'une recette déjà utilisée une fois cède la place à une alternative
// correcte, pas au point d'imposer un choix nettement moins bien ajusté.
const VARIETY_PENALTY_PER_USE = 0.35;

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // parenthèses : "Citron (jus)" -> "Citron "
    .trim()
    .replace(/s$/, ""); // pluriel simple : "Carottes" -> "Carotte" (approximatif, ne gère pas les pluriels irréguliers)
}

// Rapprochement approximatif entre le nom d'un ingrédient de recette et le
// nom d'un article de frigo — pas de catalogue d'ingrédients partagé
// aujourd'hui (décision produit assumée), donc inclusion de sous-chaîne
// insensible à la casse/accents dans les deux sens. Imprécis par nature
// (ratera "Poulet grillé" vs "Blanc de poulet" par exemple) : la détection
// de couverture qui en découle est indicative, pas garantie.
function matchesIngredientName(ingredientName: string, fridgeName: string): boolean {
  const a = normalizeName(ingredientName);
  const b = normalizeName(fridgeName);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Compose les 7 prochains jours (J+1 à J+7 à partir de startDate) × 3
// créneaux à partir des recettes communautaires, avec variété imposée
// (MAX_RECIPE_USES_PER_WEEK, jamais 2 jours de suite) et détection
// indicative de couverture par le stock actuel du frigo. Algorithme
// glouton séquentiel, dans le même esprit que findBestRecipeMatch : à
// chaque créneau, on choisit la meilleure recette compatible restante,
// jamais de recherche arrière/optimisation globale.
export function generateWeekPlan(
  recipes: RecipeInput[],
  fridgeItems: FridgeStockItem[],
  dailyTargets: MacroTargets,
  targets: NutritionTargets,
  slotContext: SlotContext,
  startDate: Date,
  excludeRecipeIds: Set<string> = new Set(),
  // Assignations à garder telles quelles (clé `${date}|${slot}` -> recipeId),
  // utilisées pour régénérer un seul repas ou une seule journée sans
  // recalculer les 21 créneaux : tout créneau absent de cette map est
  // (re)généré normalement, dans l'ordre chronologique habituel — c'est ce
  // qui permet de traiter "régénérer un repas" et "régénérer un jour"
  // avec le même mécanisme (seul le nombre de créneaux épinglés diffère).
  pinnedAssignments: Map<string, string> = new Map(),
  // Apprentissage des goûts (RecipeDecision de l'utilisateur, voir
  // recipeMatcher.computeAffinityScores) : influence légèrement le choix
  // parmi les candidats, jamais au point de contourner le budget/les
  // bornes scientifiques déjà appliquées via ratioBounds/filterByCapacity.
  affinityScores: RecipeAffinityMap = new Map()
): WeekPlan {
  const floor = computeFloor(dailyTargets);
  // Bornes AMDR déjà chargées avec slotContext.benchmark (voir dailyBudget.ts) —
  // réutilisées telles quelles comme ratioBounds pour recipeMatcher.
  const ratioBounds: MacroRatioBounds = slotContext.benchmark;
  const workingStock = fridgeItems.map((i) => ({
    name: i.name,
    gramsAvailable: quantityToGrams(i.quantity, i.unit, i.unitWeightGrams),
  }));

  const isoDates = Array.from({ length: 7 }, (_, d) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    return toIsoDate(date);
  });

  const usageCount = new Map<string, number>();
  // Tous les jours (index 0-6) où chaque recette a été utilisée — pas
  // seulement le dernier : une recette épinglée peut apparaître sur des
  // jours non consécutifs (ex. jour 1 ET jour 5), et régénérer un jour
  // intermédiaire doit détecter l'adjacence avec CHACUN d'eux, pas
  // seulement le plus récent.
  const usedDays = new Map<string, Set<number>>();

  function recordUsage(recipeId: string, dayIndex: number) {
    usageCount.set(recipeId, (usageCount.get(recipeId) ?? 0) + 1);
    const days = usedDays.get(recipeId) ?? new Set<number>();
    days.add(dayIndex);
    usedDays.set(recipeId, days);
  }

  function isAdjacentToUsedDay(recipeId: string, dayIndex: number): boolean {
    const days = usedDays.get(recipeId);
    if (!days) return false;
    return days.has(dayIndex) || days.has(dayIndex - 1) || days.has(dayIndex + 1);
  }

  // Pré-alimente la variété à partir de TOUTES les assignations épinglées
  // avant même de commencer la boucle chronologique. Indispensable : sans
  // ça, régénérer le petit-déjeuner de mercredi ne "voit" pas encore la
  // recette épinglée au petit-déjeuner de jeudi (traité plus tard dans la
  // boucle) et peut la re-proposer le jour précédent, recréant exactement
  // le problème de répétition que la contrainte est censée éviter.
  for (const [key, recipeId] of pinnedAssignments) {
    const [pinnedDate] = key.split("|");
    const dayIndex = isoDates.indexOf(pinnedDate);
    if (dayIndex === -1) continue;
    recordUsage(recipeId, dayIndex);
  }

  const days: WeekPlanDay[] = [];
  let total = 0;
  let covered = 0;

  for (let d = 0; d < 7; d++) {
    const isoDate = isoDates[d];

    let consumedSoFar: MacroTargets = { calories: 0, protein: 0, fat: 0, carbs: 0 };

    const slots: DaySlotAssignment[] = [];

    for (const [slotIndex, slot] of MEAL_SLOTS.entries()) {
      total += 1;

      // Budget du créneau : part cumulative de la journée (voir
      // dailyBudget.computeSlotBudget, même principe généralisé sur 7
      // jours simulés) moins ce qui a déjà été assigné plus tôt CE jour
      // dans le plan — jamais de vraie consommation, un jour futur repart
      // toujours de zéro.
      const cumulativeShare = MEAL_SLOTS.slice(0, slotIndex + 1).reduce(
        (sum, s) => sum + normalizedSlotShare(slotContext.benchmark, slotContext, s),
        0
      );
      const cumulativeTarget = {
        calories: targets.targetCalories * cumulativeShare,
        protein: targets.targetProteinG * cumulativeShare,
        fat: targets.targetFatG * cumulativeShare,
        carbs: targets.targetCarbsG * cumulativeShare,
      };
      const mealBudget = {
        calories: Math.max(cumulativeTarget.calories - consumedSoFar.calories, floor.calories),
        protein: Math.max(cumulativeTarget.protein - consumedSoFar.protein, floor.protein),
        fat: Math.max(cumulativeTarget.fat - consumedSoFar.fat, floor.fat),
        carbs: Math.max(cumulativeTarget.carbs - consumedSoFar.carbs, floor.carbs),
      };

      const pinnedRecipeId = pinnedAssignments.get(`${isoDate}|${slot}`);

      let bestMatch: RecipeMatch | null = null;
      if (pinnedRecipeId) {
        // Créneau épinglé (régénération ciblée d'un autre repas/jour) :
        // garde la même recette, mais recalcule ses quantités contre le
        // budget de ce créneau — identique au budget d'origine tant que
        // rien EN AMONT (même jour, créneaux précédents) n'a changé.
        const pinnedRecipe = recipes.find((r) => r.id === pinnedRecipeId);
        if (pinnedRecipe) bestMatch = matchRecipeToBudget(pinnedRecipe, mealBudget, dailyTargets, ratioBounds, affinityScores);
      } else {
        const candidates = recipes.filter((r) => {
          if (excludeRecipeIds.has(r.id)) return false;
          if (r.ingredients.length === 0) return false;
          if (!r.compatibleSlots.includes(slot)) return false;
          if ((usageCount.get(r.id) ?? 0) >= MAX_RECIPE_USES_PER_WEEK) return false;
          // Pas le même jour (ex. petit-déj et déjeuner identiques) ni un
          // jour adjacent ("pas 2 jours de suite") — dans les deux sens,
          // pour rester correct même quand un jour intermédiaire est
          // régénéré entre deux jours déjà épinglés.
          if (isAdjacentToUsedDay(r.id, d)) return false;
          return true;
        });

        if (candidates.length > 0) {
          // Écarte en amont les recettes structurellement incapables
          // d'approcher le budget de ce créneau (ex. 0 ingrédient libre et
          // un plafond dur bien en-dessous du besoin) — voir
          // recipeMatcher.filterByCapacity.
          const capable = filterByCapacity(candidates, mealBudget.calories);
          const matches = capable.map((r) => matchRecipeToBudget(r, mealBudget, dailyTargets, ratioBounds, affinityScores));
          const adjustedScore = (m: RecipeMatch) => m.fitScore + (usageCount.get(m.recipeId) ?? 0) * VARIETY_PENALTY_PER_USE;
          matches.sort((a, b) => adjustedScore(a) - adjustedScore(b));
          bestMatch = matches[0];
        }
      }

      let stockCovered = false;
      const missingIngredients: MissingIngredient[] = [];

      if (bestMatch) {
        // Les créneaux épinglés ont déjà été comptabilisés dans le
        // pré-alimentage ci-dessus (avant la boucle) : ne pas compter deux
        // fois la même occurrence.
        if (!pinnedRecipeId) {
          recordUsage(bestMatch.recipeId, d);
        }
        consumedSoFar = {
          calories: consumedSoFar.calories + bestMatch.totals.calories,
          protein: consumedSoFar.protein + bestMatch.totals.protein,
          fat: consumedSoFar.fat + bestMatch.totals.fat,
          carbs: consumedSoFar.carbs + bestMatch.totals.carbs,
        };

        for (const ingredient of bestMatch.ingredients) {
          const stockItem = workingStock
            .filter((s) => matchesIngredientName(ingredient.name, s.name) && s.gramsAvailable >= ingredient.grams)
            .sort((a, b) => b.gramsAvailable - a.gramsAvailable)[0];
          if (stockItem) {
            stockItem.gramsAvailable -= ingredient.grams;
          } else {
            missingIngredients.push({
              name: ingredient.name,
              displayQuantity: ingredient.displayQuantity,
              displayUnit: ingredient.displayUnit,
              grams: ingredient.grams,
            });
          }
        }
        stockCovered = missingIngredients.length === 0;
        if (stockCovered) covered += 1;
      }

      slots.push({ date: isoDate, slot, match: bestMatch, stockCovered, missingIngredients });
    }

    days.push({ date: isoDate, slots });
  }

  const shoppingList = buildShoppingList(days, fridgeItems);

  return { days, coverage: { total, covered }, shoppingList };
}

// Besoin total sur les 21 repas par ingrédient, comparé au stock ACTUEL
// (non décrémenté) — répond à "combien faut-il acheter au total cette
// semaine", indépendamment de l'ordre de préparation des repas.
function buildShoppingList(days: WeekPlanDay[], fridgeItems: FridgeStockItem[]): ShoppingListItem[] {
  const neededByName = new Map<string, number>();
  for (const day of days) {
    for (const s of day.slots) {
      if (!s.match) continue;
      for (const ingredient of s.match.ingredients) {
        neededByName.set(ingredient.name, (neededByName.get(ingredient.name) ?? 0) + ingredient.grams);
      }
    }
  }

  const stockByName = new Map<string, number>();
  for (const item of fridgeItems) {
    const grams = quantityToGrams(item.quantity, item.unit, item.unitWeightGrams);
    stockByName.set(item.name, (stockByName.get(item.name) ?? 0) + grams);
  }

  const list: ShoppingListItem[] = [];
  for (const [name, totalNeededGrams] of neededByName) {
    let matchedStockGrams = 0;
    for (const [stockName, stockGrams] of stockByName) {
      if (matchesIngredientName(name, stockName)) matchedStockGrams += stockGrams;
    }
    const totalShortfallGrams = Math.max(0, totalNeededGrams - matchedStockGrams);
    if (totalShortfallGrams > 0) {
      list.push({ name, totalNeededGrams: Math.round(totalNeededGrams), totalShortfallGrams: Math.round(totalShortfallGrams) });
    }
  }
  list.sort((a, b) => b.totalShortfallGrams - a.totalShortfallGrams);
  return list;
}
