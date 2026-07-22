import { matchRecipeToBudget } from "./recipeMatcher.js";
import type { RecipeInput, RecipeMatch } from "./recipeMatcher.js";
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

export interface DaySlotAssignment {
  date: string; // ISO "YYYY-MM-DD"
  slot: MealSlot;
  match: RecipeMatch | null; // null si aucune recette compatible restante (pool épuisé par la variété)
  stockCovered: boolean;
  missingIngredients: string[];
}

export interface WeekPlanDay {
  date: string;
  slots: DaySlotAssignment[];
}

export interface WeekPlan {
  days: WeekPlanDay[];
  coverage: { total: number; covered: number };
}

// Contrainte de variété : arbitraire, pas un repère scientifique — évite
// qu'une même recette sature le planning sans pour autant l'interdire
// totalement (le pool de 36 recettes reste petit).
const MAX_RECIPE_USES_PER_WEEK = 2;

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
  excludeRecipeIds: Set<string> = new Set()
): WeekPlan {
  const floor = computeFloor(dailyTargets);
  const workingStock = fridgeItems.map((i) => ({
    name: i.name,
    gramsAvailable: quantityToGrams(i.quantity, i.unit, i.unitWeightGrams),
  }));

  const usageCount = new Map<string, number>();
  const lastUsedDay = new Map<string, number>();

  const days: WeekPlanDay[] = [];
  let total = 0;
  let covered = 0;

  for (let d = 0; d < 7; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    const isoDate = toIsoDate(date);

    let consumedCaloriesSoFar = 0;
    let consumedMacrosSoFar: MacroTargets = { protein: 0, fat: 0, carbs: 0 };

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
        calories: Math.max(0, cumulativeTarget.calories - consumedCaloriesSoFar),
        protein: Math.max(cumulativeTarget.protein - consumedMacrosSoFar.protein, floor.protein),
        fat: Math.max(cumulativeTarget.fat - consumedMacrosSoFar.fat, floor.fat),
        carbs: Math.max(cumulativeTarget.carbs - consumedMacrosSoFar.carbs, floor.carbs),
      };

      const candidates = recipes.filter((r) => {
        if (excludeRecipeIds.has(r.id)) return false;
        if (r.ingredients.length === 0) return false;
        if (!r.compatibleSlots.includes(slot)) return false;
        if ((usageCount.get(r.id) ?? 0) >= MAX_RECIPE_USES_PER_WEEK) return false;
        // Pas le même jour (ex. petit-déj et déjeuner identiques) ni le jour
        // précédent ("pas 2 jours de suite").
        if (lastUsedDay.get(r.id) === d || lastUsedDay.get(r.id) === d - 1) return false;
        return true;
      });

      let bestMatch: RecipeMatch | null = null;
      if (candidates.length > 0) {
        const matches = candidates.map((r) => matchRecipeToBudget(r, mealBudget, dailyTargets));
        matches.sort((a, b) => a.fitScore - b.fitScore);
        bestMatch = matches[0];
      }

      let stockCovered = false;
      const missingIngredients: string[] = [];

      if (bestMatch) {
        usageCount.set(bestMatch.recipeId, (usageCount.get(bestMatch.recipeId) ?? 0) + 1);
        lastUsedDay.set(bestMatch.recipeId, d);
        consumedCaloriesSoFar += bestMatch.totals.calories;
        consumedMacrosSoFar = {
          protein: consumedMacrosSoFar.protein + bestMatch.totals.protein,
          fat: consumedMacrosSoFar.fat + bestMatch.totals.fat,
          carbs: consumedMacrosSoFar.carbs + bestMatch.totals.carbs,
        };

        for (const ingredient of bestMatch.ingredients) {
          const stockItem = workingStock
            .filter((s) => matchesIngredientName(ingredient.name, s.name) && s.gramsAvailable >= ingredient.grams)
            .sort((a, b) => b.gramsAvailable - a.gramsAvailable)[0];
          if (stockItem) {
            stockItem.gramsAvailable -= ingredient.grams;
          } else {
            missingIngredients.push(ingredient.name);
          }
        }
        stockCovered = missingIngredients.length === 0;
        if (stockCovered) covered += 1;
      }

      slots.push({ date: isoDate, slot, match: bestMatch, stockCovered, missingIngredients });
    }

    days.push({ date: isoDate, slots });
  }

  return { days, coverage: { total, covered } };
}
