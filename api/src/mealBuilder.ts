import { quantityToGrams, unitToGramsFactor } from "./unitConversion.js";

export interface FridgeItemLike {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitWeightGrams: number | null;
  expiresAt: Date;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

export interface MacroAmounts {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// Cibles journalières de protéines/lipides/glucides, utilisées pour définir
// un plancher de budget par macro (voir MacroBudget plus bas).
export interface MacroTargets {
  protein: number;
  fat: number;
  carbs: number;
}

export interface MealSuggestionItem {
  fridgeItemId: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface MealSuggestion {
  items: MealSuggestionItem[];
  totals: MacroAmounts;
}

interface MacroBudget {
  protein: number;
  fat: number;
  carbs: number;
}

// Catégories jouant chacune un rôle dans un repas équilibré : protéine,
// féculent (glucides), légume/fruit (volume, fibres), et un "extra" pour
// combler les lipides restants (matière grasse, produit laitier, etc.).
const PROTEIN_CATEGORIES = new Set(["Viande", "Poisson"]);
const CARB_CATEGORIES = new Set(["Féculent"]);
const VEG_CATEGORIES = new Set(["Légume", "Fruit"]);
const EXTRA_CATEGORIES = new Set(["Produit laitier", "Boisson", "Autre"]);

// Plafonds de bon sens par article (en grammes), indépendants du budget
// macro : évitent par exemple de suggérre 1kg de riz même si le budget le
// permettrait techniquement.
const SANITY_CAP_GRAMS = { protein: 350, carb: 200, veg: 300, extra: 80 };

function pickBest(items: FridgeItemLike[], categories: Set<string>, excludeIds: Set<string>): FridgeItemLike | null {
  const candidates = items.filter((i) => categories.has(i.category) && i.quantity > 0 && !excludeIds.has(i.id));
  if (candidates.length === 0) return null;
  // Priorité à ce qui expire le plus tôt, pour limiter le gaspillage.
  candidates.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  return candidates[0];
}

// Pour la source de protéines : privilégie un bon ratio protéines/lipides
// plutôt que la seule date de péremption. Sans ça, un article protéiné mais
// gras (ex. steak haché) épuise le budget lipides (souvent le plus serré)
// avant d'avoir livré assez de protéines, laissant la barre protéines très
// en dessous de l'objectif en fin de journée.
function pickBestProtein(items: FridgeItemLike[], excludeIds: Set<string>): FridgeItemLike | null {
  const candidates = items.filter((i) => PROTEIN_CATEGORIES.has(i.category) && i.quantity > 0 && !excludeIds.has(i.id));
  if (candidates.length === 0) return null;
  const efficiency = (i: FridgeItemLike) => i.proteinPer100g / (i.fatPer100g + 2);
  candidates.sort((a, b) => {
    const diff = efficiency(b) - efficiency(a);
    if (Math.abs(diff) > 0.5) return diff;
    return a.expiresAt.getTime() - b.expiresAt.getTime();
  });
  return candidates[0];
}

// Grammes maximum d'un article avant de dépasser le budget macro du repas
// sur N'IMPORTE LAQUELLE des dimensions encore "actives" (protéines/
// lipides/glucides) — c'est ce qui empêche un "extra" riche en gras
// (fromage, avocat) de faire exploser le budget lipides même s'il a été
// choisi pour autre chose. Une dimension déjà tombée à son plancher (sa
// part du repas a été livrée, souvent en dépassement à cause d'un
// arrondi à la pièce) n'est plus considérée comme contraignante : sinon
// elle bloquerait à tort tous les articles suivants, y compris ceux
// choisis spécifiquement pour combler une AUTRE macro.
function maxGramsForBudget(item: FridgeItemLike, budget: MacroBudget, floor: MacroBudget): number {
  let max = Infinity;
  if (item.proteinPer100g > 0 && budget.protein > floor.protein * 1.01) {
    max = Math.min(max, (budget.protein / item.proteinPer100g) * 100);
  }
  if (item.fatPer100g > 0 && budget.fat > floor.fat * 1.01) {
    max = Math.min(max, (budget.fat / item.fatPer100g) * 100);
  }
  if (item.carbsPer100g > 0 && budget.carbs > floor.carbs * 1.01) {
    max = Math.min(max, (budget.carbs / item.carbsPer100g) * 100);
  }
  return Math.max(0, max);
}

function computePortionGrams(
  item: FridgeItemLike,
  targetGrams: number,
  sanityCapGrams: number,
  budget: MacroBudget,
  floor: MacroBudget
): number {
  const availGrams = quantityToGrams(item.quantity, item.unit, item.unitWeightGrams);
  const budgetCapGrams = maxGramsForBudget(item, budget, floor);
  const cappedGrams = Math.min(targetGrams, availGrams, sanityCapGrams, budgetCapGrams);
  if (cappedGrams <= 0) return 0;

  const factor = unitToGramsFactor(item.unit, item.unitWeightGrams);
  const normalizedUnit = item.unit.trim().toLowerCase();
  if (normalizedUnit !== "g" && normalizedUnit !== "kg" && normalizedUnit !== "l") {
    // Unité comptable (ex. "pièce") : arrondi à l'unité entière la plus
    // proche, au moins 1, sans dépasser le stock. Si même 1 unité dépasse
    // le budget de plus de moitié, on renonce plutôt que de le forcer.
    const units = Math.round(cappedGrams / factor);
    if (units <= 0 && cappedGrams < factor * 0.5) return 0;
    const boundedUnits = Math.min(Math.max(1, units), item.quantity);
    return boundedUnits * factor;
  }
  // Grammes/kg/litres : arrondi à 5g près pour un affichage propre.
  const roundedGrams = Math.round(cappedGrams / 5) * 5;
  return Math.min(roundedGrams, availGrams);
}

function toSuggestionItem(item: FridgeItemLike, portionGrams: number): MealSuggestionItem {
  const factor = unitToGramsFactor(item.unit, item.unitWeightGrams);
  const quantity = Math.round((portionGrams / factor) * 100) / 100;
  const ratio = portionGrams / 100;
  return {
    fridgeItemId: item.id,
    name: item.name,
    quantity,
    unit: item.unit,
    calories: Math.round(item.caloriesPer100g * ratio),
    protein: Math.round(item.proteinPer100g * ratio * 10) / 10,
    fat: Math.round(item.fatPer100g * ratio * 10) / 10,
    carbs: Math.round(item.carbsPer100g * ratio * 10) / 10,
  };
}

// En dépensant le budget au fil des articles choisis, on garde toujours un
// petit plancher par macro plutôt que de tomber à 0 : sans ça, une trace de
// lipides dans un "extra" (fromage...) peut faire chuter le budget lipides
// pile à 0 et bloquer ensuite TOUT complément protéiné, même une source qui
// n'a qu'un soupçon de gras (maxGramsForBudget renverrait 0 pour tout item
// avec fatPer100g > 0).
function subtractFromBudget(budget: MacroBudget, item: MealSuggestionItem, floor: MacroBudget): MacroBudget {
  return {
    protein: Math.max(floor.protein, budget.protein - item.protein),
    fat: Math.max(floor.fat, budget.fat - item.fat),
    carbs: Math.max(floor.carbs, budget.carbs - item.carbs),
  };
}

export function buildMealSuggestion(
  allItems: FridgeItemLike[],
  remaining: MacroAmounts,
  dailyTargets: MacroTargets,
  mealsRemaining: number,
  excludeIds: Set<string> = new Set()
): MealSuggestion | null {
  const meals = Math.max(1, Math.round(mealsRemaining));

  // Budget de CE repas : une fraction de ce qu'il reste pour la journée,
  // avec un petit plancher (3% de l'objectif journalier) pour ne pas
  // bloquer totalement un article à cause d'une macro déjà quasi comblée.
  let budget: MacroBudget = {
    protein: Math.max(remaining.protein / meals, dailyTargets.protein * 0.03),
    fat: Math.max(remaining.fat / meals, dailyTargets.fat * 0.03),
    carbs: Math.max(remaining.carbs / meals, dailyTargets.carbs * 0.03),
  };
  const mealBudget: MacroBudget = { ...budget };
  const floor: MacroBudget = {
    protein: dailyTargets.protein * 0.03,
    fat: dailyTargets.fat * 0.03,
    carbs: dailyTargets.carbs * 0.03,
  };

  const proteinItem = pickBestProtein(allItems, excludeIds);
  const carbItem = pickBest(allItems, CARB_CATEGORIES, excludeIds);

  // Un repas a besoin d'au moins une source de protéines ou de glucides
  // pour avoir du sens ; sans les deux, le frigo n'a pas de quoi composer.
  if (!proteinItem && !carbItem) return null;

  const selected: MealSuggestionItem[] = [];

  if (proteinItem) {
    const targetGrams = proteinItem.proteinPer100g > 0 ? (budget.protein / proteinItem.proteinPer100g) * 100 : 0;
    const portionGrams = computePortionGrams(proteinItem, targetGrams, SANITY_CAP_GRAMS.protein, budget, floor);
    if (portionGrams > 0) {
      const item = toSuggestionItem(proteinItem, portionGrams);
      selected.push(item);
      budget = subtractFromBudget(budget, item, floor);
    }
  }

  if (carbItem) {
    const targetGrams = carbItem.carbsPer100g > 0 ? (budget.carbs / carbItem.carbsPer100g) * 100 : 0;
    const portionGrams = computePortionGrams(carbItem, targetGrams, SANITY_CAP_GRAMS.carb, budget, floor);
    if (portionGrams > 0) {
      const item = toSuggestionItem(carbItem, portionGrams);
      selected.push(item);
      budget = subtractFromBudget(budget, item, floor);
    }
  }

  // Légume/fruit pour le volume et les fibres — portion "standard" de
  // 150g, mais toujours plafonnée par le budget macro restant (un avocat
  // ou une banane comptent aussi en lipides/glucides, pas seulement les
  // féculents et les "extras").
  const vegItem = pickBest(allItems, VEG_CATEGORIES, excludeIds);
  if (vegItem) {
    const portionGrams = computePortionGrams(vegItem, 150, SANITY_CAP_GRAMS.veg, budget, floor);
    if (portionGrams > 0) {
      const item = toSuggestionItem(vegItem, portionGrams);
      selected.push(item);
      budget = subtractFromBudget(budget, item, floor);
    }
  }

  // Extra (matière grasse, produit laitier...) pour combler ce qu'il reste
  // de lipides dans le budget de ce repas, seulement s'il en reste
  // significativement.
  const extraItem = pickBest(allItems, EXTRA_CATEGORIES, excludeIds);
  if (extraItem && budget.fat > dailyTargets.fat * 0.05) {
    const targetGrams = extraItem.fatPer100g > 0 ? (budget.fat / extraItem.fatPer100g) * 100 : 0;
    const portionGrams = computePortionGrams(extraItem, targetGrams, SANITY_CAP_GRAMS.extra, budget, floor);
    if (portionGrams > 0) {
      const item = toSuggestionItem(extraItem, portionGrams);
      selected.push(item);
      budget = subtractFromBudget(budget, item, floor);
    }
  }

  // Compléments si le budget de CE repas n'est pas comblé après les choix
  // de base (ex. portion plafonnée par le stock disponible, ou beaucoup de
  // repas restants donc gros budget par repas) : ajoute une deuxième
  // source de protéines puis, si besoin, de glucides — toujours accompagnée
  // du reste déjà choisi (le repas ne devient jamais "que de la viande").
  // Le seuil de déclenchement est relatif au budget DE CE repas (et non à
  // l'objectif journalier entier), pour rester pertinent quel que soit le
  // nombre de repas restants choisi par l'utilisateur.
  for (let round = 0; round < 2; round++) {
    const usedIds = new Set([...excludeIds, ...selected.map((s) => s.fridgeItemId)]);

    if (budget.protein > mealBudget.protein * 0.2) {
      const topUpItem = pickBestProtein(allItems, usedIds);
      if (topUpItem) {
        const targetGrams = topUpItem.proteinPer100g > 0 ? (budget.protein / topUpItem.proteinPer100g) * 100 : 0;
        const portionGrams = computePortionGrams(topUpItem, targetGrams, SANITY_CAP_GRAMS.protein, budget, floor);
        if (portionGrams > 0) {
          const item = toSuggestionItem(topUpItem, portionGrams);
          selected.push(item);
          budget = subtractFromBudget(budget, item, floor);
          continue;
        }
      }
    }

    if (budget.carbs > mealBudget.carbs * 0.2) {
      const topUpItem = pickBest(allItems, CARB_CATEGORIES, usedIds);
      if (topUpItem) {
        const targetGrams = topUpItem.carbsPer100g > 0 ? (budget.carbs / topUpItem.carbsPer100g) * 100 : 0;
        const portionGrams = computePortionGrams(topUpItem, targetGrams, SANITY_CAP_GRAMS.carb, budget, floor);
        if (portionGrams > 0) {
          const item = toSuggestionItem(topUpItem, portionGrams);
          selected.push(item);
          budget = subtractFromBudget(budget, item, floor);
          continue;
        }
      }
    }

    break;
  }

  if (selected.length === 0) return null;

  const totals = selected.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      fat: acc.fat + i.fat,
      carbs: acc.carbs + i.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  return { items: selected, totals };
}
