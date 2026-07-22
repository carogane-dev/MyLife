import { useEffect, useState } from "react";
import { getNutritionConfig } from "./api.js";
import type { NutritionBenchmark, NutritionModeConfigEntry } from "./api.js";
import { GOAL_MODE_OPTIONS } from "./NutritionTargetsSummary.js";

const BODY_TYPE_LABELS: Record<string, string> = {
  endurance: "Endurance",
  athletic: "Athlétique équilibré",
  mass: "Sculpté / sec et musclé",
};

function goalModeLabel(goalMode: string): string {
  return GOAL_MODE_OPTIONS.find((o) => o.value === goalMode)?.label ?? goalMode;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

export default function ScientificDataPage({ onBack }: { onBack: () => void }) {
  const [modeConfigs, setModeConfigs] = useState<NutritionModeConfigEntry[] | null>(null);
  const [benchmark, setBenchmark] = useState<NutritionBenchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNutritionConfig()
      .then((result) => {
        setModeConfigs(result.modeConfigs);
        setBenchmark(result.benchmark);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="scientific-data-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>🔬 Données scientifiques</h2>
      <p className="wizard-hint">
        Les repères utilisés pour calculer tes objectifs et composer tes repas — issus de l'AMDR (Institute of
        Medicine) et de l'ISSN (nutrition sportive) quand une source existe, sinon marqués comme un choix produit
        assumé. Cette page reflète toujours les valeurs actuellement en base, mise à jour automatiquement si elles
        évoluent.
      </p>

      {loading && <p className="scan-status">Chargement…</p>}
      {error && <p className="fridge-error">{error}</p>}

      {!loading && modeConfigs && benchmark && (
        <>
          <h3>Objectifs caloriques par mode</h3>
          <p className="wizard-hint">
            Multiplicateur appliqué à ta dépense quotidienne totale (TDEE), apport protéique cible par kg de poids, et
            part des calories venant des lipides — voir "Comment ces chiffres sont calculés" dans tes objectifs pour
            le détail du calcul.
          </p>
          <ul className="meal-item-list">
            {modeConfigs.map((c) => (
              <li className="meal-item-row scientific-data-row" key={`${c.goalMode}-${c.bodyType ?? "none"}`}>
                <span className="meal-item-name">
                  {goalModeLabel(c.goalMode)}
                  {c.bodyType && ` — ${BODY_TYPE_LABELS[c.bodyType] ?? c.bodyType}`}
                </span>
                <span className="scientific-data-values">
                  ×{c.calorieMultiplier} TDEE · {c.proteinPerKg} g/kg protéines · {formatPercent(c.fatPercent)} lipides
                </span>
                <span className="scientific-data-source">{c.source}</span>
              </li>
            ))}
          </ul>

          <h3>Répartition intra-journalière par défaut</h3>
          <p className="wizard-hint">
            Part de la cible calorique journalière attribuée à chaque créneau — utilisée par le composeur et le
            planning hebdomadaire pour dimensionner chaque repas (personnalisable par profil, pas encore d'écran de
            réglage).
          </p>
          <ul className="meal-item-list">
            <li className="meal-item-row">
              <span className="meal-item-name">🌅 Petit-déjeuner</span>
              <span className="meal-item-macros">{formatPercent(benchmark.defaultBreakfastPercent)}</span>
            </li>
            <li className="meal-item-row">
              <span className="meal-item-name">☀️ Déjeuner</span>
              <span className="meal-item-macros">{formatPercent(benchmark.defaultLunchPercent)}</span>
            </li>
            <li className="meal-item-row">
              <span className="meal-item-name">🌙 Dîner</span>
              <span className="meal-item-macros">{formatPercent(benchmark.defaultDinnerPercent)}</span>
            </li>
          </ul>

          <h3>Bornes scientifiques par repas (AMDR / ISSN)</h3>
          <p className="wizard-hint">
            Fourchettes recommandées pour la part de chaque macro dans les calories d'un repas — désormais appliquées
            automatiquement au choix de chaque recette (planning hebdomadaire et composeur du jour, mode recette) :
            un repas dont la répartition s'écarte de ces bornes est pénalisé lors de la sélection, au même titre
            qu'un écart de calories.
          </p>
          <ul className="meal-item-list">
            <li className="meal-item-row">
              <span className="meal-item-name">🌾 Glucides</span>
              <span className="meal-item-macros">
                {formatPercent(benchmark.carbPercentMin)} – {formatPercent(benchmark.carbPercentMax)}
              </span>
            </li>
            <li className="meal-item-row">
              <span className="meal-item-name">🥑 Lipides</span>
              <span className="meal-item-macros">
                {formatPercent(benchmark.fatPercentMin)} – {formatPercent(benchmark.fatPercentMax)}
              </span>
            </li>
            <li className="meal-item-row">
              <span className="meal-item-name">🥩 Protéines</span>
              <span className="meal-item-macros">
                {formatPercent(benchmark.proteinPercentMin)} – {formatPercent(benchmark.proteinPercentMax)}
              </span>
            </li>
            <li className="meal-item-row">
              <span className="meal-item-name">🥩 Protéines (ISSN, sport)</span>
              <span className="meal-item-macros">
                {benchmark.issnProteinPerKgMin} – {benchmark.issnProteinPerKgMax} g/kg
              </span>
            </li>
          </ul>

          <p className="nutrition-targets-disclaimer">
            Repères généraux, pas un avis médical personnalisé — en cas de besoin spécifique (pathologie, grossesse,
            etc.), consulte un professionnel de santé.
          </p>
        </>
      )}
    </div>
  );
}
