// Mécanique de budget par macro partagée entre mealBuilder.ts (frigo) et
// recipeMatcher.ts (recette) — factorisée ici car les deux fichiers
// dupliquaient une logique quasi identique.

export interface MacroBudget {
  protein: number;
  fat: number;
  carbs: number;
}

export interface MacroTargets {
  protein: number;
  fat: number;
  carbs: number;
}

interface PerHundredGrams {
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

interface MacroDelta {
  protein: number;
  fat: number;
  carbs: number;
}

// Plancher par macro : 3% de la cible journalière, pour ne jamais bloquer
// totalement un article/ingrédient à cause d'une macro déjà quasi comblée
// (voir maxGramsForBudget et subtractFromBudget ci-dessous).
export function computeFloor(dailyTargets: MacroTargets): MacroBudget {
  return {
    protein: dailyTargets.protein * 0.03,
    fat: dailyTargets.fat * 0.03,
    carbs: dailyTargets.carbs * 0.03,
  };
}

// Grammes maximum d'un article/ingrédient avant de dépasser le budget macro
// du repas sur N'IMPORTE LAQUELLE des dimensions encore "actives"
// (protéines/lipides/glucides). Une dimension déjà tombée à son plancher
// n'est plus considérée comme contraignante : sinon elle bloquerait à tort
// tous les choix suivants, y compris ceux visant une AUTRE macro.
export function maxGramsForBudget(item: PerHundredGrams, budget: MacroBudget, floor: MacroBudget): number {
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

// Dépense le budget au fil des choix, sans jamais tomber sous le plancher —
// une trace de lipides dans un item par ailleurs choisi pour ses protéines
// ne doit pas faire chuter le budget lipides pile à 0 et bloquer ensuite
// tout complément protéiné.
export function subtractFromBudget(budget: MacroBudget, delta: MacroDelta, floor: MacroBudget): MacroBudget {
  return {
    protein: Math.max(floor.protein, budget.protein - delta.protein),
    fat: Math.max(floor.fat, budget.fat - delta.fat),
    carbs: Math.max(floor.carbs, budget.carbs - delta.carbs),
  };
}
