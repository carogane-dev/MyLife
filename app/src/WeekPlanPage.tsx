import { useEffect, useState } from "react";
import { getWeekPlan } from "./api.js";
import type { MealSlot, WeekPlan } from "./api.js";

const SLOT_LABELS: Record<MealSlot, string> = {
  "petit-dejeuner": "🌅 Petit-déjeuner",
  dejeuner: "☀️ Déjeuner",
  diner: "🌙 Dîner",
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export default function WeekPlanPage({ onBack }: { onBack: () => void }) {
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(excludeIds: string[] = []) {
    setLoading(true);
    setError(null);
    getWeekPlan(excludeIds)
      .then((result) => {
        setWeekPlan(result.weekPlan);
        setReason(result.reason ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  function regenerate() {
    if (!weekPlan) {
      load();
      return;
    }
    const shownIds = weekPlan.days.flatMap((day) => day.slots.map((s) => s.match?.recipeId).filter((id): id is string => !!id));
    load([...new Set(shownIds)]);
  }

  return (
    <div className="week-plan-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>📅 Planning de la semaine</h2>
      <p className="wizard-hint">
        Une proposition de repas pour les 7 prochains jours, à partir des recettes de la communauté. Lecture seule pour
        l'instant — tu pourras bientôt valider ou refuser chaque repas.
      </p>

      {loading && <p className="scan-status">Composition du planning…</p>}
      {error && <p className="fridge-error">{error}</p>}
      {!loading && !weekPlan && reason && <p className="fridge-empty">{reason}</p>}

      {!loading && weekPlan && (
        <>
          <div className="week-plan-coverage">
            <strong>{weekPlan.coverage.covered}</strong> / {weekPlan.coverage.total} repas déjà couvrables avec ton
            stock actuel
          </div>

          <button className="logout-button week-plan-regenerate" onClick={regenerate}>
            🔄 Régénérer le planning
          </button>

          <div className="week-plan-days">
            {weekPlan.days.map((day) => (
              <div className="week-plan-day" key={day.date}>
                <h3 className="week-plan-day-title">{formatDate(day.date)}</h3>
                <ul className="meal-item-list">
                  {day.slots.map((assignment) => (
                    <li className="meal-item-row week-plan-slot-row" key={`${day.date}-${assignment.slot}`}>
                      <span className="meal-item-name">
                        {SLOT_LABELS[assignment.slot]}
                        {" — "}
                        {assignment.match ? assignment.match.recipeName : "— aucune recette disponible —"}
                      </span>
                      {assignment.match && (
                        <>
                          <span className="meal-item-macros">{assignment.match.totals.calories} kcal</span>
                          <span className={assignment.stockCovered ? "recipe-badge healthy" : "recipe-badge"}>
                            {assignment.stockCovered ? "✅ En stock" : `🛒 À acheter (${assignment.missingIngredients.length})`}
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
