import { useEffect, useState } from "react";
import {
  acceptWeekPlanEntry,
  getWeekPlan,
  logManualConsumption,
  markWeekPlanEntryEaten,
  regenerateWeekPlanDay,
  rejectWeekPlanEntry,
  resetWeekPlan,
} from "./api.js";
import type { MealSlot, WeekPlan, WeekPlanDay, WeekPlanEntryStatus, WeekPlanSlotAssignment } from "./api.js";

const SLOT_LABELS: Record<MealSlot, string> = {
  "petit-dejeuner": "🌅 Petit-déjeuner",
  dejeuner: "☀️ Déjeuner",
  diner: "🌙 Dîner",
};

const STATUS_LABELS: Record<WeekPlanEntryStatus, string> = {
  proposed: "🕓 Proposé",
  accepted: "✅ Accepté",
  eaten: "🍽️ Mangé",
  exhausted: "😕 Épuisé — ajuste manuellement",
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;
}

// Premier créneau encore en attente de décision, dans l'ordre chronologique
// du planning — sert de "carte courante" en mode revue, sans état séparé à
// garder synchronisé : dérivé du planning à chaque rendu.
function findFirstProposed(weekPlan: WeekPlan): { day: WeekPlanDay; slot: WeekPlanSlotAssignment } | null {
  for (const day of weekPlan.days) {
    for (const slot of day.slots) {
      if (slot.status === "proposed" && slot.match) return { day, slot };
    }
  }
  return null;
}

export default function WeekPlanPage({ onBack }: { onBack: () => void }) {
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"apercu" | "revue">("apercu");
  const [confirmingReset, setConfirmingReset] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    getWeekPlan()
      .then((result) => {
        setWeekPlan(result.weekPlan);
        setReason(result.reason ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  // Si plus aucun créneau n'est en attente (tout accepté/mangé/épuisé),
  // revenir automatiquement à l'aperçu plutôt que de garder une revue vide.
  useEffect(() => {
    if (mode === "revue" && weekPlan && !findFirstProposed(weekPlan)) {
      setMode("apercu");
    }
  }, [mode, weekPlan]);

  async function runAction(key: string, action: () => Promise<{ weekPlan: WeekPlan | null; reason?: string }>) {
    setBusyKey(key);
    setError(null);
    try {
      const result = await action();
      setWeekPlan(result.weekPlan);
      setReason(result.reason ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusyKey(null);
    }
  }

  function handleAccept(entryId: string) {
    void runAction(`accept:${entryId}`, () => acceptWeekPlanEntry(entryId));
  }

  function handleReject(entryId: string) {
    void runAction(`reject:${entryId}`, () => rejectWeekPlanEntry(entryId));
  }

  async function handleEat(assignment: WeekPlanSlotAssignment) {
    if (!assignment.match) return;
    setBusyKey(`eat:${assignment.entryId}`);
    setError(null);
    try {
      await logManualConsumption(
        {
          name: assignment.match.recipeName,
          quantity: 1,
          unit: "portion",
          calories: assignment.match.totals.calories,
          protein: assignment.match.totals.protein,
          fat: assignment.match.totals.fat,
          carbs: assignment.match.totals.carbs,
        },
        assignment.slot
      );
      const result = await markWeekPlanEntryEaten(assignment.entryId);
      setWeekPlan(result.weekPlan);
      setReason(result.reason ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusyKey(null);
    }
  }

  function handleRegenerateDay(date: string) {
    void runAction(`day:${date}`, () => regenerateWeekPlanDay(date));
  }

  function handleReset() {
    void runAction("reset", () => resetWeekPlan());
    setConfirmingReset(false);
  }

  function shortfallFor(name: string): number | null {
    const entry = weekPlan?.shoppingList.find((s) => s.name === name);
    return entry ? entry.totalShortfallGrams : null;
  }

  const hasProposed = !!weekPlan && !!findFirstProposed(weekPlan);
  const current = mode === "revue" && weekPlan ? findFirstProposed(weekPlan) : null;

  return (
    <div className="week-plan-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>📅 Planning de la semaine</h2>
      <p className="wizard-hint">
        Une proposition de repas pour les 7 prochains jours, à partir des recettes de la communauté. Accepte ou
        refuse chaque repas — ton choix est mémorisé, même si tu recharges la page.
      </p>

      {loading && <p className="scan-status">Composition du planning…</p>}
      {error && <p className="fridge-error">{error}</p>}
      {!loading && !weekPlan && reason && <p className="fridge-empty">{reason}</p>}

      {!loading && weekPlan && mode === "apercu" && (
        <>
          <div className="week-plan-coverage">
            <strong>{weekPlan.coverage.covered}</strong> / {weekPlan.coverage.total} repas déjà couvrables avec ton
            stock actuel
          </div>

          <div className="week-plan-toolbar">
            {hasProposed && (
              <button className="logout-button week-plan-regenerate" onClick={() => setMode("revue")} disabled={!!busyKey}>
                👉 Réviser mon planning
              </button>
            )}
            {!confirmingReset ? (
              <button className="week-plan-reset-button" onClick={() => setConfirmingReset(true)} disabled={!!busyKey}>
                🔄 Recommencer le planning
              </button>
            ) : (
              <span className="week-plan-reset-confirm">
                Supprimer les décisions déjà prises et recommencer ?
                <button className="week-plan-reset-button danger" onClick={handleReset} disabled={busyKey === "reset"}>
                  {busyKey === "reset" ? "…" : "Confirmer"}
                </button>
                <button className="week-plan-mini-regen" onClick={() => setConfirmingReset(false)} disabled={!!busyKey}>
                  Annuler
                </button>
              </span>
            )}
          </div>

          <div className="week-plan-days">
            {weekPlan.days.map((day) => {
              const dayHasProposed = day.slots.some((s) => s.status === "proposed" && s.match);
              return (
                <div className="week-plan-day" key={day.date}>
                  <div className="week-plan-day-header">
                    <h3 className="week-plan-day-title">{formatDate(day.date)}</h3>
                    {dayHasProposed && (
                      <button
                        className="week-plan-mini-regen"
                        onClick={() => handleRegenerateDay(day.date)}
                        disabled={!!busyKey}
                        title="Régénère les repas encore en attente de ce jour"
                      >
                        {busyKey === `day:${day.date}` ? "…" : "🔄 Ce qui reste"}
                      </button>
                    )}
                  </div>
                  <ul className="meal-item-list">
                    {day.slots.map((assignment) => (
                      <li className="meal-item-row week-plan-slot-row" key={assignment.entryId}>
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
                          <span className={`week-plan-status-badge week-plan-status-${assignment.status}`}>
                            {STATUS_LABELS[assignment.status]}
                          </span>
                          {(assignment.status === "accepted" || assignment.status === "exhausted") && assignment.match && (
                            <button
                              className="week-plan-eat-button"
                              onClick={() => void handleEat(assignment)}
                              disabled={!!busyKey}
                            >
                              {busyKey === `eat:${assignment.entryId}` ? "…" : "✅ Manger ce repas"}
                            </button>
                          )}
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
              );
            })}
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

      {!loading && weekPlan && mode === "revue" && current && (
        <div className="week-plan-review">
          <button className="week-plan-mini-regen week-plan-review-exit" onClick={() => setMode("apercu")}>
            ← Retour à l'aperçu
          </button>

          <div
            className={`week-plan-review-card ${busyKey === `reject:${current.slot.entryId}` ? "exiting" : ""}`}
            key={current.slot.entryId + (current.slot.match?.recipeId ?? "")}
          >
            <p className="week-plan-review-slot">
              {formatDate(current.day.date)} · {SLOT_LABELS[current.slot.slot]}
            </p>
            <h3>{current.slot.match?.recipeName}</h3>
            {current.slot.match && (
              <>
                <p className="meal-suggestion-totals">
                  <span>
                    <strong>{current.slot.match.totals.calories}</strong> kcal
                  </span>
                  <span>{current.slot.match.totals.protein} g protéines</span>
                  <span>{current.slot.match.totals.fat} g lipides</span>
                  <span>{current.slot.match.totals.carbs} g glucides</span>
                </p>
                <ul className="meal-item-list">
                  {current.slot.match.ingredients.map((ing) => (
                    <li className="meal-item-row" key={ing.name}>
                      <span className="meal-item-name">
                        {ing.name}
                        {ing.flexible && <span className="recipe-flexible-tag"> · libre</span>}
                      </span>
                      <span className="meal-item-qty">
                        {ing.displayQuantity} {ing.displayUnit}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="week-plan-review-actions">
              <button
                className="week-plan-review-reject"
                onClick={() => handleReject(current.slot.entryId)}
                disabled={!!busyKey}
              >
                {busyKey === `reject:${current.slot.entryId}` ? "…" : "❌ Refuser"}
              </button>
              <button
                className="week-plan-review-accept"
                onClick={() => handleAccept(current.slot.entryId)}
                disabled={!!busyKey}
              >
                {busyKey === `accept:${current.slot.entryId}` ? "…" : "✅ Accepter"}
              </button>
            </div>
            {current.slot.attempts >= 4 && (
              <p className="week-plan-review-attempts-warning">
                Essai {current.slot.attempts} / 5 — après 5 refus, ce créneau sera marqué "à ajuster manuellement".
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
