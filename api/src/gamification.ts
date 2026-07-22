import { prisma } from "./db.js";
import { computeDailyBudget, isDayComplete } from "./dailyBudget.js";
import type { MacroAmounts } from "./dailyBudget.js";

// Tout est dérivé à la volée depuis ConsumptionEntry/RecipeDecision — aucune
// table de gamification dédiée (pas de compteur à maintenir à jour à chaque
// point d'écriture, jamais de désynchronisation possible). Fenêtre bornée à
// 90 jours : largement suffisante pour un streak/historique personnel, évite
// de scanner un historique illimité à chaque chargement de l'accueil.
const HISTORY_WINDOW_DAYS = 90;

// Constantes arbitraires (pas un repère scientifique), même esprit que
// MAX_RECIPE_USES_PER_WEEK/VARIETY_PENALTY_PER_USE dans weekPlanner.ts.
const POINTS_PER_MEAL_LOGGED = 10;
const POINTS_PER_DAY_COMPLETE = 50;
const POINTS_PER_RECIPE_ACCEPTED = 5;
const POINTS_PER_LEVEL = 200;

export interface GamificationBadge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
}

export interface GamificationSummary {
  streak: {
    // null si le profil n'a pas de cible calorique (mode Libre) : la notion
    // de "jour réussi" n'existe pas dans ce cas, pas de streak à 0 trompeur.
    currentDays: number | null;
    bestDays: number | null;
  };
  totalPoints: number;
  level: number;
  mealsLogged: number;
  badges: GamificationBadge[];
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function localMidnight(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function computeGamificationSummary(userId: string): Promise<GamificationSummary> {
  const windowStart = localMidnight(new Date());
  windowStart.setDate(windowStart.getDate() - HISTORY_WINDOW_DAYS);

  const [budgetInfo, entries, acceptedDecisions] = await Promise.all([
    computeDailyBudget(userId),
    prisma.consumptionEntry.findMany({
      where: { userId, consumedAt: { gte: windowStart } },
      select: { calories: true, protein: true, fat: true, carbs: true, consumedAt: true },
    }),
    prisma.recipeDecision.findMany({ where: { userId, accepted: true }, select: { recipeId: true } }),
  ]);

  const mealsLogged = entries.length;
  const distinctRecipesAccepted = new Set(acceptedDecisions.map((d) => d.recipeId)).size;

  // Regroupe les repas journalisés par jour calendaire LOCAL (pas UTC) —
  // même convention que dailyBudget.ts, pour que "un jour" corresponde à ce
  // que l'utilisateur voit ailleurs dans l'app (barres du jour, etc.).
  const dayTotals = new Map<string, MacroAmounts>();
  for (const e of entries) {
    const key = localDateKey(e.consumedAt);
    const acc = dayTotals.get(key) ?? { calories: 0, protein: 0, fat: 0, carbs: 0 };
    acc.calories += e.calories;
    acc.protein += e.protein;
    acc.fat += e.fat;
    acc.carbs += e.carbs;
    dayTotals.set(key, acc);
  }

  let currentStreakDays: number | null = null;
  let bestStreakDays: number | null = null;
  let daysCompleteCount = 0;

  if (budgetInfo) {
    const { targets } = budgetInfo;
    const isDayKeyComplete = (key: string): boolean => {
      const totals = dayTotals.get(key);
      if (!totals) return false;
      const remaining: MacroAmounts = {
        calories: Math.max(0, targets.targetCalories - totals.calories),
        protein: Math.max(0, targets.targetProteinG - totals.protein),
        fat: Math.max(0, targets.targetFatG - totals.fat),
        carbs: Math.max(0, targets.targetCarbsG - totals.carbs),
      };
      return isDayComplete(remaining, targets);
    };

    const today = localMidnight(new Date());

    // Meilleur streak jamais atteint dans la fenêtre : les badges de streak
    // restent acquis même après une série interrompue.
    let running = 0;
    let best = 0;
    for (const cursor = new Date(windowStart); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
      if (isDayKeyComplete(localDateKey(cursor))) {
        daysCompleteCount += 1;
        running += 1;
        best = Math.max(best, running);
      } else {
        running = 0;
      }
    }
    bestStreakDays = best;

    // Streak courant : remonte depuis aujourd'hui. Un aujourd'hui pas encore
    // complet n'interrompt PAS un streak déjà en cours (la journée n'est pas
    // terminée) — on l'inclut seulement s'il est déjà complet, puis on
    // continue depuis hier dans tous les cas.
    let current = 0;
    const cursor = new Date(today);
    if (isDayKeyComplete(localDateKey(cursor))) current += 1;
    cursor.setDate(cursor.getDate() - 1);
    while (cursor >= windowStart && isDayKeyComplete(localDateKey(cursor))) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    currentStreakDays = current;
  }

  const totalPoints =
    mealsLogged * POINTS_PER_MEAL_LOGGED +
    daysCompleteCount * POINTS_PER_DAY_COMPLETE +
    acceptedDecisions.length * POINTS_PER_RECIPE_ACCEPTED;
  const level = 1 + Math.floor(totalPoints / POINTS_PER_LEVEL);

  const badges: GamificationBadge[] = [
    { id: "first-meal", label: "Premier repas", icon: "🍽️", earned: mealsLogged >= 1 },
    { id: "week-streak", label: "Une semaine de suite", icon: "🔥", earned: (bestStreakDays ?? 0) >= 7 },
    { id: "month-streak", label: "Un mois de suite", icon: "🏅", earned: (bestStreakDays ?? 0) >= 30 },
    { id: "ten-recipes", label: "Dix recettes différentes", icon: "📖", earned: distinctRecipesAccepted >= 10 },
    { id: "fifty-meals", label: "50 repas journalisés", icon: "💯", earned: mealsLogged >= 50 },
    { id: "level-five", label: "Niveau 5", icon: "🌟", earned: level >= 5 },
  ];

  return {
    streak: { currentDays: currentStreakDays, bestDays: bestStreakDays },
    totalPoints,
    level,
    mealsLogged,
    badges,
  };
}
