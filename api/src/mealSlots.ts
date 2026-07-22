// Le créneau de repas est un paramètre structurant du composeur (frigo et
// recette) : il influence le budget macro du repas (voir normalizedSlotShare
// et dailyBudget.computeSlotBudget) ET les rôles alimentaires favorisés
// (voir MEAL_SLOT_ROLE_CONFIG, utilisé par mealBuilder.ts/recipeMatcher.ts).

export type MealSlot = "petit-dejeuner" | "dejeuner" | "diner";

export const MEAL_SLOTS: MealSlot[] = ["petit-dejeuner", "dejeuner", "diner"];

export function isMealSlot(value: unknown): value is MealSlot {
  return value === "petit-dejeuner" || value === "dejeuner" || value === "diner";
}

interface SlotPercentOverrides {
  breakfastCaloriePercent: number | null;
  lunchCaloriePercent: number | null;
  dinnerCaloriePercent: number | null;
}

interface SlotPercentDefaults {
  defaultBreakfastPercent: number;
  defaultLunchPercent: number;
  defaultDinnerPercent: number;
}

// Part de la cible calorique journalière attribuée à ce créneau. Les 3
// pourcentages par défaut (issus de NutritionBenchmark, milieux des
// fourchettes 20-25/35-40/25-30% documentées) somment à 87.5% et non 100% —
// volontairement, pour garder les valeurs telles que citées dans leur
// source. On les normalise ici, à l'usage, plutôt que de forcer 100% en
// base : garantit que la somme des 3 parts (petit-déj + déjeuner + dîner)
// vaut toujours exactement 1, donc que la somme des budgets de créneaux
// reconstitue exactement le budget journalier, sans jamais le dépasser.
export function normalizedSlotShare(
  benchmark: SlotPercentDefaults,
  profile: SlotPercentOverrides,
  slot: MealSlot
): number {
  const raw: Record<MealSlot, number> = {
    "petit-dejeuner": profile.breakfastCaloriePercent ?? benchmark.defaultBreakfastPercent,
    dejeuner: profile.lunchCaloriePercent ?? benchmark.defaultLunchPercent,
    diner: profile.dinnerCaloriePercent ?? benchmark.defaultDinnerPercent,
  };
  const sum = raw["petit-dejeuner"] + raw.dejeuner + raw.diner;
  if (sum <= 0) return 1 / 3;
  return raw[slot] / sum;
}

export interface SlotRoleConfig {
  // Sous-catégories de FridgeItem pénalisées (repoussées en fin de tri, pas
  // exclues) pour la source de protéines sur ce créneau — un choix moins
  // adapté reste préférable à aucune suggestion si le frigo n'offre rien
  // d'autre. Statut : arbitraire, dérivé du principe qualitatif de la spec
  // ("viande rouge/plat lourd déprioritisé le matin"), pas d'une liste
  // scientifique — à ajuster si l'usage réel montre un mauvais réglage.
  proteinPenaltySubcategories: Set<string>;
  // Ordre de préférence des catégories "extra" (matière grasse/laitier) sur
  // ce créneau, avant le critère de péremption. Statut : arbitraire.
  extraPreferredCategories: string[];
  // Portion cible de légume/fruit en grammes, avant plafonnement par le
  // budget macro du repas (remplace le 150g fixe de l'ancienne version).
  // Statut : arbitraire.
  vegPortionGrams: number;
  // Plafonds de bon sens par article, indépendants du budget macro — réduits
  // le soir pour une densité calorique plus faible ("portions réduites le
  // soir", spec section 2). Statut : arbitraire.
  sanityCapGrams: { protein: number; carb: number; veg: number; extra: number };
  // Autorise un 2e round de complément protéiné si le budget du repas n'est
  // pas comblé après la sélection de base — désactivé au petit-déjeuner
  // pour éviter un repas trop lourd. Statut : arbitraire.
  allowSecondProteinTopUp: boolean;
}

export const MEAL_SLOT_ROLE_CONFIG: Record<MealSlot, SlotRoleConfig> = {
  "petit-dejeuner": {
    proteinPenaltySubcategories: new Set(["Bœuf", "Porc", "Agneau"]),
    extraPreferredCategories: ["Produit laitier", "Autre"],
    vegPortionGrams: 80,
    sanityCapGrams: { protein: 200, carb: 150, veg: 150, extra: 60 },
    allowSecondProteinTopUp: false,
  },
  dejeuner: {
    proteinPenaltySubcategories: new Set(),
    extraPreferredCategories: ["Produit laitier", "Autre"],
    vegPortionGrams: 150,
    sanityCapGrams: { protein: 350, carb: 200, veg: 300, extra: 80 },
    allowSecondProteinTopUp: true,
  },
  diner: {
    proteinPenaltySubcategories: new Set(),
    extraPreferredCategories: ["Autre", "Produit laitier"],
    vegPortionGrams: 100,
    sanityCapGrams: { protein: 300, carb: 150, veg: 250, extra: 60 },
    allowSecondProteinTopUp: false,
  },
};
