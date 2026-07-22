import { quantityToGrams, unitToGramsFactor } from "./unitConversion.js";
import { computeFloor, maxGramsForBudget, subtractFromBudget } from "./mealBudgetMath.js";
import type { MacroBudget, MacroTargets } from "./mealBudgetMath.js";
import { MEAL_SLOT_ROLE_CONFIG } from "./mealSlots.js";
import type { MealSlot } from "./mealSlots.js";

export interface FridgeItemLike {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  quantity: number;
  unit: string;
  unitWeightGrams: number | null;
  expiresAt: Date;
  compatibleSlots: string[];
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

// Catégories jouant chacune un rôle dans un repas équilibré : protéine,
// féculent (glucides), légume/fruit (volume, fibres), et un "extra" pour
// combler les lipides restants (matière grasse, produit laitier, etc.).
// Ce mapping catégorie→rôle est commun à tous les créneaux ; ce qui varie
// PAR créneau (pénalité de sous-catégorie, préférence d'extra, portions,
// plafonds) vient de MEAL_SLOT_ROLE_CONFIG, voir mealSlots.ts.
const PROTEIN_CATEGORIES = new Set(["Viande", "Poisson"]);
const CARB_CATEGORIES = new Set(["Féculent"]);
const VEG_CATEGORIES = new Set(["Légume", "Fruit"]);
const EXTRA_CATEGORIES = new Set(["Produit laitier", "Boisson", "Autre"]);

function pickBest(
  items: FridgeItemLike[],
  categories: Set<string>,
  excludeIds: Set<string>,
  preferredOrder: string[] = []
): FridgeItemLike | null {
  const candidates = items.filter((i) => categories.has(i.category) && i.quantity > 0 && !excludeIds.has(i.id));
  if (candidates.length === 0) return null;
  const rank = (item: FridgeItemLike) => {
    const idx = preferredOrder.indexOf(item.category);
    return idx === -1 ? preferredOrder.length : idx;
  };
  // Priorité à la catégorie préférée pour ce créneau (ex. Produit laitier au
  // petit-déjeuner), puis à ce qui expire le plus tôt, pour limiter le
  // gaspillage.
  candidates.sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.expiresAt.getTime() - b.expiresAt.getTime();
  });
  return candidates[0];
}

// Pour la source de protéines : privilégie un bon ratio protéines/lipides
// plutôt que la seule date de péremption. Sans ça, un article protéiné mais
// gras (ex. steak haché) épuise le budget lipides (souvent le plus serré)
// avant d'avoir livré assez de protéines, laissant la barre protéines très
// en dessous de l'objectif en fin de journée. Les sous-catégories pénalisées
// pour ce créneau (ex. "Bœuf" le matin) sont repoussées en fin de tri, pas
// exclues : un choix moins adapté reste préférable à aucune suggestion.
function pickBestProtein(
  items: FridgeItemLike[],
  excludeIds: Set<string>,
  penaltySubcategories: Set<string>
): FridgeItemLike | null {
  const candidates = items.filter((i) => PROTEIN_CATEGORIES.has(i.category) && i.quantity > 0 && !excludeIds.has(i.id));
  if (candidates.length === 0) return null;
  const efficiency = (i: FridgeItemLike) => i.proteinPer100g / (i.fatPer100g + 2);
  const penalty = (i: FridgeItemLike) => (penaltySubcategories.has(i.subcategory) ? 1 : 0);
  candidates.sort((a, b) => {
    const penaltyDiff = penalty(a) - penalty(b);
    if (penaltyDiff !== 0) return penaltyDiff;
    const diff = efficiency(b) - efficiency(a);
    if (Math.abs(diff) > 0.5) return diff;
    return a.expiresAt.getTime() - b.expiresAt.getTime();
  });
  return candidates[0];
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

// allItems n'est PAS filtré par créneau par l'appelant : buildMealSuggestion
// s'en charge (Couche 1, filtre dur — voir MEAL_SLOT_ROLE_CONFIG pour la
// Couche 2, pondération douce des rôles). mealBudget est déjà le budget
// final de CE repas pour CE créneau (voir dailyBudget.computeSlotBudget),
// pas un total à diviser ici.
export function buildMealSuggestion(
  allItems: FridgeItemLike[],
  mealBudget: MacroAmounts,
  dailyTargets: MacroTargets,
  slot: MealSlot,
  excludeIds: Set<string> = new Set()
): MealSuggestion | null {
  const slotItems = allItems.filter((i) => i.compatibleSlots.includes(slot));
  const config = MEAL_SLOT_ROLE_CONFIG[slot];

  let budget: MacroBudget = { protein: mealBudget.protein, fat: mealBudget.fat, carbs: mealBudget.carbs };
  const mealBudgetSnapshot: MacroBudget = { ...budget };
  const floor = computeFloor(dailyTargets);

  const proteinItem = pickBestProtein(slotItems, excludeIds, config.proteinPenaltySubcategories);
  const carbItem = pickBest(slotItems, CARB_CATEGORIES, excludeIds);

  // Un repas a besoin d'au moins une source de protéines ou de glucides
  // pour avoir du sens ; sans les deux, le frigo n'a pas de quoi composer
  // pour ce créneau.
  if (!proteinItem && !carbItem) return null;

  const selected: MealSuggestionItem[] = [];

  if (proteinItem) {
    const targetGrams = proteinItem.proteinPer100g > 0 ? (budget.protein / proteinItem.proteinPer100g) * 100 : 0;
    const portionGrams = computePortionGrams(proteinItem, targetGrams, config.sanityCapGrams.protein, budget, floor);
    if (portionGrams > 0) {
      const item = toSuggestionItem(proteinItem, portionGrams);
      selected.push(item);
      budget = subtractFromBudget(budget, item, floor);
    }
  }

  if (carbItem) {
    const targetGrams = carbItem.carbsPer100g > 0 ? (budget.carbs / carbItem.carbsPer100g) * 100 : 0;
    const portionGrams = computePortionGrams(carbItem, targetGrams, config.sanityCapGrams.carb, budget, floor);
    if (portionGrams > 0) {
      const item = toSuggestionItem(carbItem, portionGrams);
      selected.push(item);
      budget = subtractFromBudget(budget, item, floor);
    }
  }

  // Légume/fruit pour le volume et les fibres — portion "standard" du
  // créneau (config.vegPortionGrams), toujours plafonnée par le budget
  // macro restant (un avocat ou une banane comptent aussi en lipides/
  // glucides, pas seulement les féculents et les "extras").
  const vegItem = pickBest(slotItems, VEG_CATEGORIES, excludeIds);
  if (vegItem) {
    const portionGrams = computePortionGrams(vegItem, config.vegPortionGrams, config.sanityCapGrams.veg, budget, floor);
    if (portionGrams > 0) {
      const item = toSuggestionItem(vegItem, portionGrams);
      selected.push(item);
      budget = subtractFromBudget(budget, item, floor);
    }
  }

  // Extra (matière grasse, produit laitier...) pour combler ce qu'il reste
  // de lipides dans le budget de ce repas, seulement s'il en reste
  // significativement. Catégorie préférée pour ce créneau en premier (ex.
  // Produit laitier au petit-déjeuner).
  const extraItem = pickBest(slotItems, EXTRA_CATEGORIES, excludeIds, config.extraPreferredCategories);
  if (extraItem && budget.fat > dailyTargets.fat * 0.05) {
    const targetGrams = extraItem.fatPer100g > 0 ? (budget.fat / extraItem.fatPer100g) * 100 : 0;
    const portionGrams = computePortionGrams(extraItem, targetGrams, config.sanityCapGrams.extra, budget, floor);
    if (portionGrams > 0) {
      const item = toSuggestionItem(extraItem, portionGrams);
      selected.push(item);
      budget = subtractFromBudget(budget, item, floor);
    }
  }

  // Compléments si le budget de CE repas n'est pas comblé après les choix
  // de base (ex. portion plafonnée par le stock disponible) : ajoute une
  // deuxième source de glucides, et de protéines seulement si ce créneau
  // l'autorise (config.allowSecondProteinTopUp — désactivé au petit-déjeuner
  // pour éviter un repas trop lourd). Le repas ne devient jamais "que de la
  // viande". Le seuil de déclenchement est relatif au budget DE CE repas.
  for (let round = 0; round < 2; round++) {
    const usedIds = new Set([...excludeIds, ...selected.map((s) => s.fridgeItemId)]);

    if (config.allowSecondProteinTopUp && budget.protein > mealBudgetSnapshot.protein * 0.2) {
      const topUpItem = pickBestProtein(slotItems, usedIds, config.proteinPenaltySubcategories);
      if (topUpItem) {
        const targetGrams = topUpItem.proteinPer100g > 0 ? (budget.protein / topUpItem.proteinPer100g) * 100 : 0;
        const portionGrams = computePortionGrams(topUpItem, targetGrams, config.sanityCapGrams.protein, budget, floor);
        if (portionGrams > 0) {
          const item = toSuggestionItem(topUpItem, portionGrams);
          selected.push(item);
          budget = subtractFromBudget(budget, item, floor);
          continue;
        }
      }
    }

    if (budget.carbs > mealBudgetSnapshot.carbs * 0.2) {
      const topUpItem = pickBest(slotItems, CARB_CATEGORIES, usedIds);
      if (topUpItem) {
        const targetGrams = topUpItem.carbsPer100g > 0 ? (budget.carbs / topUpItem.carbsPer100g) * 100 : 0;
        const portionGrams = computePortionGrams(topUpItem, targetGrams, config.sanityCapGrams.carb, budget, floor);
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
