import type { ChoiceOption } from "./ChoiceCards.js";
import type { BodyType, GoalMode, NutritionTargets, Sex } from "./nutritionCalculator.js";
import BodySilhouette from "./BodySilhouette.js";

export const GOAL_MODE_OPTIONS: ChoiceOption[] = [
  {
    value: "frigo_only",
    label: "Mode Libre",
    description: "Pas d'objectif calorique, juste ton inventaire.",
    badge: "☆☆☆ Aucune pression",
  },
  {
    value: "chill",
    label: "Mode Chill",
    description: "Suit tes calories vers un objectif, sans pression excessive.",
    badge: "★☆☆ Souple",
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
    description: "Déficit maximal et protéines au max pour un physique sec et musclé (choisis ta morphologie).",
    badge: "★★★ Extrême",
  },
];

const BODY_TYPE_LABELS: Record<Sex, Record<BodyType, { label: string; description: string }>> = {
  homme: {
    endurance: { label: "Coureur / Élancé", description: "Déficit marqué, corps sec, glucides élevés pour l'endurance." },
    athletic: { label: "Athlétique équilibré", description: "Déficit soutenu, musclé et défini." },
    mass: { label: "Sculpté / Sec et musclé", description: "Déficit maximal, protéines au max pour préserver le muscle." },
  },
  femme: {
    endurance: { label: "Coureuse / Élancée", description: "Déficit marqué, corps sec, glucides élevés pour l'endurance." },
    athletic: { label: "Tonique équilibrée", description: "Déficit soutenu, musclée et définie." },
    mass: { label: "Sculptée / Sec et musclée", description: "Déficit maximal, protéines au max pour préserver le muscle." },
  },
  autre: {
    endurance: { label: "Élancé(e) / Endurance", description: "Déficit marqué, corps sec, glucides élevés pour l'endurance." },
    athletic: { label: "Athlétique équilibré(e)", description: "Déficit soutenu, musclé(e) et défini(e)." },
    mass: { label: "Sculpté(e) / Sec et musclé(e)", description: "Déficit maximal, protéines au max pour préserver le muscle." },
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
  frigo_only: "Mode Libre",
  chill: "Mode Chill",
  ligne: "Rester en forme",
  elite: "Mode Élite",
};

function explanationReason(
  goalMode: GoalMode,
  bodyType: BodyType | null | undefined,
  sex: Sex | undefined,
  targets: NutritionTargets
): string {
  if (goalMode === "chill") {
    return "Objectif proche de ta dépense quotidienne (TDEE), sans déficit marqué — un suivi volontairement souple, facile à tenir au jour le jour.";
  }
  if (goalMode === "ligne") {
    return "Le déficit est volontairement modéré, avec des protéines élevées (2,2g/kg) pour préserver ta masse musculaire pendant la perte.";
  }
  if (goalMode === "elite" && bodyType) {
    const labels = BODY_TYPE_LABELS[sex ?? "autre"] ?? BODY_TYPE_LABELS.autre;
    const proteinNote: Record<BodyType, string> = {
      endurance: "des protéines élevées adaptées à l'effort d'endurance, glucides généreux pour l'énergie",
      athletic: "des protéines élevées pour un physique défini et musclé",
      mass: "des protéines poussées au maximum pour préserver un maximum de muscle malgré le déficit",
    };
    return `Déficit marqué pour viser un physique type "${labels[bodyType].label}" : ${proteinNote[bodyType]}.`;
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
    return <p className="nutrition-targets-free">💪 Choisis ta morphologie ci-dessous pour voir tes objectifs.</p>;
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
