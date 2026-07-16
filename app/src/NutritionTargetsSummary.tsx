import type { ChoiceOption } from "./ChoiceCards.js";
import type { BodyType, GoalMode, NutritionTargets, Sex } from "./nutritionCalculator.js";
import BodySilhouette from "./BodySilhouette.js";

export const GOAL_MODE_OPTIONS: ChoiceOption[] = [
  {
    value: "precision",
    label: "Mode Sniper",
    description: "Vise l'exact TDEE calculé, aucune marge.",
    badge: "★★★ Extrême",
  },
  {
    value: "ligne",
    label: "Rester en forme",
    description: "Déficit modéré, protéines élevées pour préserver le muscle.",
    badge: "★★☆ Modérée",
  },
  {
    value: "elite",
    label: "Mode Élite",
    description: "Apports optimisés pour un physique ciblé (choisis ta morphologie).",
    badge: "🏆 Physique ciblé",
  },
  {
    value: "frigo_only",
    label: "Mode Libre",
    description: "Pas d'objectif calorique, juste ton inventaire.",
    badge: "☆☆☆ Aucune pression",
  },
];

const BODY_TYPE_LABELS: Record<Sex, Record<BodyType, { label: string; description: string }>> = {
  homme: {
    endurance: { label: "Coureur / Élancé", description: "Corps sec, endurance, glucides élevés." },
    athletic: { label: "Athlétique équilibré", description: "Musclé et défini, léger surplus." },
    mass: { label: "Bodybuilder / Masse max", description: "Surplus calorique, développement musculaire maximal." },
  },
  femme: {
    endurance: { label: "Coureuse / Élancée", description: "Corps sec, endurance, glucides élevés." },
    athletic: { label: "Tonique équilibrée", description: "Musclée et définie, léger surplus." },
    mass: { label: "Fitness galbée / Masse max", description: "Surplus calorique, développement musculaire maximal." },
  },
  autre: {
    endurance: { label: "Élancé(e) / Endurance", description: "Corps sec, endurance, glucides élevés." },
    athletic: { label: "Athlétique équilibré(e)", description: "Musclé(e) et défini(e), léger surplus." },
    mass: { label: "Masse musculaire max", description: "Surplus calorique, développement musculaire maximal." },
  },
};

export function getBodyTypeOptions(sex: Sex): ChoiceOption[] {
  const labels = BODY_TYPE_LABELS[sex] ?? BODY_TYPE_LABELS.autre;
  return (Object.keys(labels) as BodyType[]).map((type) => ({
    value: type,
    label: labels[type].label,
    description: labels[type].description,
    icon: <BodySilhouette type={type} />,
  }));
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentaire: "sédentaire",
  leger: "légèrement actif",
  modere: "modérément actif",
  actif: "actif",
  tres_actif: "très actif",
};

const GOAL_MODE_LABELS: Record<GoalMode, string> = {
  precision: "Mode Sniper",
  ligne: "Rester en forme",
  elite: "Mode Élite",
  frigo_only: "Mode Libre",
};

function explanationReason(
  goalMode: GoalMode,
  bodyType: BodyType | null | undefined,
  sex: Sex | undefined,
  targets: NutritionTargets
): string {
  if (goalMode === "ligne") {
    return "Le déficit est volontairement modéré, avec des protéines élevées (2,2g/kg) pour préserver ta masse musculaire pendant la perte.";
  }
  if (goalMode === "elite" && bodyType) {
    const labels = BODY_TYPE_LABELS[sex ?? "autre"] ?? BODY_TYPE_LABELS.autre;
    const proteinNote =
      targets.proteinPerKgUsed >= 2
        ? "des protéines élevées pour maximiser le développement musculaire"
        : "des protéines modérées adaptées à l'endurance";
    return `Les apports sont ajustés pour viser un physique type "${labels[bodyType].label}" : ${proteinNote}.`;
  }
  return "Répartition standard : protéines et lipides à des niveaux de référence pour un objectif neutre.";
}

export default function NutritionTargetsSummary({
  goalMode,
  bodyType,
  sex,
  targets,
  activityLevel,
}: {
  goalMode: GoalMode;
  bodyType?: BodyType | null;
  sex?: Sex;
  targets: NutritionTargets | null;
  activityLevel?: string;
}) {
  if (goalMode === "frigo_only") {
    return <p className="nutrition-targets-free">🧊 Pas de suivi calorique — concentre-toi sur ton frigo.</p>;
  }

  if (goalMode === "elite" && !bodyType) {
    return <p className="nutrition-targets-free">🏆 Choisis ta morphologie ci-dessous pour voir tes objectifs.</p>;
  }

  if (!targets) {
    return null;
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
        <p>{explanationReason(goalMode, bodyType, sex, targets)}</p>
      </details>
    </div>
  );
}
