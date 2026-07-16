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
const PROTEIN_CATEGORIES = new Set(["Viande", "Poisson"]);
const CARB_CATEGORIES = new Set(["Féculent"]);
const VEG_CATEGORIES = new Set(["Légume", "Fruit"]);
const EXTRA_CATEGORIES = new Set(["Produit laitier", "Boisson", "Autre"]);

function pickBest(items: FridgeItemLike[], categories: Set<string>, excludeIds: Set<string>): FridgeItemLike | null {
  const candidates = items.filter((i) => categories.has(i.category) && i.quantity > 0 && !excludeIds.has(i.id));
  if (candidates.length === 0) return null;
  // Priorité à ce qui expire le plus tôt, pour limiter le gaspillage.
  candidates.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  return candidates[0];
}

// Calcule la portion réellement servie (en grammes), en respectant :
// le besoin macro visé, le stock disponible, et un plafond de bon sens
// (éviter de suggérer 1kg de riz pour un seul repas).
function roundPortionGrams(item: FridgeItemLike, targetGrams: number, capGrams: number): number {
  const factor = unitToGramsFactor(item.unit, item.unitWeightGrams);
  const availGrams = quantityToGrams(item.quantity, item.unit, item.unitWeightGrams);
  const cappedGrams = Math.min(targetGrams, availGrams, capGrams);
  if (cappedGrams <= 0) return 0;

  const normalizedUnit = item.unit.trim().toLowerCase();
  if (normalizedUnit !== "g" && normalizedUnit !== "kg" && normalizedUnit !== "l") {
    // Unité comptable (ex. "pièce") : arrondi à l'unité entière la plus
    // proche, au moins 1, sans dépasser le stock.
    const units = Math.max(1, Math.round(cappedGrams / factor));
    return Math.min(units, item.quantity) * factor;
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

export function buildMealSuggestion(
  allItems: FridgeItemLike[],
  remaining: MacroAmounts,
  excludeIds: Set<string> = new Set()
): MealSuggestion | null {
  const proteinItem = pickBest(allItems, PROTEIN_CATEGORIES, excludeIds);
  const carbItem = pickBest(allItems, CARB_CATEGORIES, excludeIds);

  // Un repas a besoin d'au moins une source de protéines ou de glucides
  // pour avoir du sens ; sans les deux, le frigo n'a pas de quoi composer.
  if (!proteinItem && !carbItem) return null;

  const selected: MealSuggestionItem[] = [];
  let usedProtein = 0;
  let usedCarbs = 0;
  let usedFat = 0;

  if (proteinItem) {
    const targetGrams =
      remaining.protein > 0 && proteinItem.proteinPer100g > 0 ? (remaining.protein / proteinItem.proteinPer100g) * 100 : 0;
    const portionGrams = roundPortionGrams(proteinItem, targetGrams, 300);
    if (portionGrams > 0) {
      const item = toSuggestionItem(proteinItem, portionGrams);
      selected.push(item);
      usedProtein += item.protein;
      usedCarbs += item.carbs;
      usedFat += item.fat;
    }
  }

  if (carbItem) {
    const remainingCarbs = Math.max(0, remaining.carbs - usedCarbs);
    const targetGrams = remainingCarbs > 0 && carbItem.carbsPer100g > 0 ? (remainingCarbs / carbItem.carbsPer100g) * 100 : 0;
    const portionGrams = roundPortionGrams(carbItem, targetGrams, 150);
    if (portionGrams > 0) {
      const item = toSuggestionItem(carbItem, portionGrams);
      selected.push(item);
      usedProtein += item.protein;
      usedCarbs += item.carbs;
      usedFat += item.fat;
    }
  }

  // Un légume ou fruit pour le volume et les fibres, sans viser une macro
  // précise (portion standard, plafonnée par le stock disponible).
  const vegItem = pickBest(allItems, VEG_CATEGORIES, excludeIds);
  if (vegItem) {
    const portionGrams = roundPortionGrams(vegItem, 150, 250);
    if (portionGrams > 0) {
      const item = toSuggestionItem(vegItem, portionGrams);
      selected.push(item);
      usedFat += item.fat;
      usedCarbs += item.carbs;
    }
  }

  // S'il reste un déficit de lipides notable, complète avec un "extra"
  // (matière grasse, produit laitier...), en petite quantité.
  const remainingFat = Math.max(0, remaining.fat - usedFat);
  if (remainingFat > 5) {
    const extraItem = pickBest(allItems, EXTRA_CATEGORIES, excludeIds);
    if (extraItem && extraItem.fatPer100g > 0) {
      const targetGrams = (remainingFat / extraItem.fatPer100g) * 100;
      const portionGrams = roundPortionGrams(extraItem, targetGrams, 50);
      if (portionGrams > 0) {
        selected.push(toSuggestionItem(extraItem, portionGrams));
      }
    }
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
