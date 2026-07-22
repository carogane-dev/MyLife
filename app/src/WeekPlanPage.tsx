import { useEffect, useState } from "react";
import { getWeekPlan, regenerateWeekPlan } from "./api.js";
import type { MealSlot, PinnedAssignment, WeekPlan, WeekPlanDay } from "./api.js";

const SLOT_LABELS: Record<MealSlot, string> = {
  "petit-dejeuner": "🌅 Petit-déjeuner",
  dejeuner: "☀️ Déjeuner",
  diner: "🌙 Dîner",
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;
}

// Construit la liste des assignations à épingler pour une régénération
// ciblée : tout le planning SAUF les créneaux passés dans `except`.
function buildPinned(weekPlan: WeekPlan, except: { date: string; slot: MealSlot }[]): PinnedAssignment[] {
  const exceptKeys = new Set(except.map((e) => `${e.date}|${e.slot}`));
  const pinned: PinnedAssignment[] = [];
  for (const day of weekPlan.days) {
    for (const s of day.slots) {
      if (exceptKeys.has(`${day.date}|${s.slot}`)) continue;
      if (s.match) pinned.push({ date: day.date, slot: s.slot, recipeId: s.match.recipeId });
    }
  }
  return pinned;
}

export default function WeekPlanPage({ onBack }: { onBack: () => void }) {
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<string | null>(null);
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

  function regenerateAll() {
    if (!weekPlan) {
      load();
      return;
    }
    const shownIds = weekPlan.days.flatMap((day) => day.slots.map((s) => s.match?.recipeId).filter((id): id is string => !!id));
    load([...new Set(shownIds)]);
  }

  async function regenerateTargets(targets: { date: string; slot: MealSlot }[], key: string) {
    if (!weekPlan) return;
    setRegenerating(key);
    setError(null);
    try {
      const pinned = buildPinned(weekPlan, targets);
      const excludeIds = targets
        .map((t) => weekPlan.days.find((d) => d.date === t.date)?.slots.find((s) => s.slot === t.slot)?.match?.recipeId)
        .filter((id): id is string => !!id);
      const result = await regenerateWeekPlan(pinned, excludeIds);
      setWeekPlan(result.weekPlan);
      setReason(result.reason ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setRegenerating(null);
    }
  }

  function regenerateMeal(date: string, slot: MealSlot) {
    void regenerateTargets([{ date, slot }], `${date}|${slot}`);
  }

  function regenerateDay(day: WeekPlanDay) {
    void regenerateTargets(
      day.slots.map((s) => ({ date: day.date, slot: s.slot })),
      day.date
    );
  }

  function shortfallFor(name: string): number | null {
    const entry = weekPlan?.shoppingList.find((s) => s.name === name);
    return entry ? entry.totalShortfallGrams : null;
  }

  return (
    <div className="week-plan-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>📅 Planning de la semaine</h2>
      <p className="wizard-hint">
        Une proposition de repas pour les 7 prochains jours, à partir des recettes de la communauté. Régénère un repas,
        un jour, ou tout le planning si quelque chose ne te convient pas.
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

          <button className="logout-button week-plan-regenerate" onClick={regenerateAll} disabled={!!regenerating}>
            🔄 Régénérer tout le planning
          </button>

          <div className="week-plan-days">
            {weekPlan.days.map((day) => (
              <div className="week-plan-day" key={day.date}>
                <div className="week-plan-day-header">
                  <h3 className="week-plan-day-title">{formatDate(day.date)}</h3>
                  <button
                    className="week-plan-mini-regen"
                    onClick={() => regenerateDay(day)}
                    disabled={!!regenerating}
                    title="Régénérer ce jour"
                  >
                    {regenerating === day.date ? "…" : "🔄 Ce jour"}
                  </button>
                </div>
                <ul className="meal-item-list">
                  {day.slots.map((assignment) => (
                    <li className="meal-item-row week-plan-slot-row" key={`${day.date}-${assignment.slot}`}>
                      <div className="week-plan-slot-main">
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
                        <button
                          className="week-plan-mini-regen"
                          onClick={() => regenerateMeal(day.date, assignment.slot)}
                          disabled={!!regenerating}
                          title="Régénérer ce repas"
                        >
                          {regenerating === `${day.date}|${assignment.slot}` ? "…" : "🔄"}
                        </button>
                      </div>

                      {assignment.match && assignment.missingIngredients.length > 0 && (
                        <ul className="week-plan-missing-list">
                          {assignment.missingIngredients.map((mi) => {
                            const shortfall = shortfallFor(mi.name);
                            return (
                              <li key={mi.name}>
                                {mi.name} — {mi.displayQuantity} {mi.displayUnit} pour ce repas
                                {shortfall !== null && (
                                  <span className="week-plan-missing-total"> · {formatGrams(shortfall)} cette semaine</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {weekPlan.shoppingList.length > 0 && (
            <div className="week-plan-shopping-list">
              <h3>🛒 Liste de courses de la semaine</h3>
              <p className="wizard-hint">
                Ce qu'il manque au total pour couvrir les 21 repas — diminue au fur et à mesure que tu ajoutes ces
                aliments à ton frigo.
              </p>
              <ul className="meal-item-list">
                {weekPlan.shoppingList.map((item) => (
                  <li className="meal-item-row" key={item.name}>
                    <span className="meal-item-name">{item.name}</span>
                    <span className="meal-item-macros">{formatGrams(item.totalShortfallGrams)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
