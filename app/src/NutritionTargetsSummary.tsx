import type { ChoiceOption } from "./ChoiceCards.js";
import type { GoalMode, NutritionTargets } from "./nutritionCalculator.js";
import { ACTIVITY_MULTIPLIERS } from "./nutritionCalculator.js";

export const GOAL_MODE_OPTIONS: ChoiceOption[] = [
  {
    value: "precision",
    label: "Mode Sniper",
    description: "Vise l'exact TDEE calculé, aucune marge.",
    badge: "★★★ Extrême",
  },
  {
    value: "ligne",
    label: "Garder la ligne",
    description: "Léger déficit pour rester affûté, plus de marge.",
    badge: "★★☆ Modérée",
  },
  {
    value: "frigo_only",
    label: "Mode Libre",
    description: "Pas d'objectif calorique, juste ton inventaire.",
    badge: "☆☆☆ Aucune pression",
  },
];

const ACTIVITY_LABELS: Record<string, string> = {
  sedentaire: "sédentaire",
  leger: "légèrement actif",
  modere: "modérément actif",
  actif: "actif",
  tres_actif: "très actif",
};

const GOAL_MODE_LABELS: Record<GoalMode, string> = {
  precision: "Mode Sniper",
  ligne: "Garder la ligne",
  frigo_only: "Mode Libre",
};

export default function NutritionTargetsSummary({
  goalMode,
  targets,
  activityLevel,
}: {
  goalMode: GoalMode;
  targets: NutritionTargets | null;
  activityLevel?: string;
}) {
  if (!targets || goalMode === "frigo_only") {
    return <p className="nutrition-targets-free">🧊 Pas de suivi calorique — concentre-toi sur ton frigo.</p>;
  }

  return (
    <div className="nutrition-targets">
      <div className="nutrition-targets-grid">
        <div className="nutrition-stat nutrition-stat-calories">
          <span className="nutrition-stat-icon">🔥</span>
          <span className="nutrition-stat-value">{targets.targetCalories}</span>
          <span className="nutrition-stat-label">kcal / jour</span>
        </div>
        <div className="nutrition-stat">
          <span className="nutrition-stat-icon">🥩</span>
          <span className="nutrition-stat-value">{targets.targetProteinG}g</span>
          <span className="nutrition-stat-label">protéines</span>
        </div>
        <div className="nutrition-stat">
          <span className="nutrition-stat-icon">🥑</span>
          <span className="nutrition-stat-value">{targets.targetFatG}g</span>
          <span className="nutrition-stat-label">lipides</span>
        </div>
        <div className="nutrition-stat">
          <span className="nutrition-stat-icon">🌾</span>
          <span className="nutrition-stat-value">{targets.targetCarbsG}g</span>
          <span className="nutrition-stat-label">glucides</span>
        </div>
      </div>

      <details className="nutrition-targets-explanation">
        <summary>Comment ces chiffres sont calculés</summary>
        <p>
          Ton métabolisme de base (BMR) est de <strong>{targets.bmr} kcal</strong>, calculé à partir de ton poids,
          ta taille, ton âge et ton sexe (formule de Mifflin-St Jeor).
        </p>
        <p>
          Avec un niveau d'activité {activityLevel ? ACTIVITY_LABELS[activityLevel] : ""} (×{targets.activityMultiplier}),
          ta dépense quotidienne totale (TDEE) est d'environ <strong>{targets.tdee} kcal</strong>.
        </p>
        <p>
          Avec le mode <strong>{GOAL_MODE_LABELS[goalMode]}</strong>, ton objectif est de{" "}
          <strong>{targets.targetCalories} kcal</strong> par jour.
        </p>
        <p>
          Répartition : 1,8g de protéines par kg de poids corporel, 30% des calories en lipides, le reste en
          glucides.
        </p>
      </details>
    </div>
  );
}
