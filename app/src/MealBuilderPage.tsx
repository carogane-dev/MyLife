import { useEffect, useState } from "react";
import { getMealSuggestion, markItemEaten } from "./api.js";
import type { MealSuggestion } from "./api.js";

export default function MealBuilderPage({ onBack }: { onBack: () => void }) {
  const [suggestion, setSuggestion] = useState<MealSuggestion | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [eating, setEating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eaten, setEaten] = useState(false);
  const [mealsRemaining, setMealsRemaining] = useState(3);

  function load(excludeIds: string[] = [], meals = mealsRemaining) {
    setLoading(true);
    setError(null);
    setEaten(false);
    getMealSuggestion(excludeIds, meals)
      .then(({ suggestion, reason }) => {
        setSuggestion(suggestion);
        setReason(reason ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  function changeMealsRemaining(value: number) {
    const clamped = Math.min(6, Math.max(1, value));
    setMealsRemaining(clamped);
    load([], clamped);
  }

  async function handleEat() {
    if (!suggestion) return;
    setEating(true);
    setError(null);
    try {
      for (const item of suggestion.items) {
        await markItemEaten(item.fridgeItemId, item.quantity);
      }
      setEaten(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setEating(false);
    }
  }

  function regenerate() {
    if (!suggestion) return;
    load(suggestion.items.map((i) => i.fridgeItemId));
  }

  return (
    <div className="meal-builder-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>🍳 Composer un repas</h2>
      <p className="wizard-hint">Une suggestion basée sur ton frigo et ce qu'il te reste à atteindre aujourd'hui.</p>

      <div className="meals-remaining-control">
        <span>Repas restants aujourd'hui (dont celui-ci) :</span>
        <div className="meals-remaining-stepper">
          <button onClick={() => changeMealsRemaining(mealsRemaining - 1)} disabled={mealsRemaining <= 1 || loading}>
            −
          </button>
          <strong>{mealsRemaining}</strong>
          <button onClick={() => changeMealsRemaining(mealsRemaining + 1)} disabled={mealsRemaining >= 6 || loading}>
            +
          </button>
        </div>
      </div>

      {loading && <p className="scan-status">Recherche des meilleurs ingrédients…</p>}
      {error && <p className="fridge-error">{error}</p>}

      {!loading && !suggestion && reason && <p className="fridge-empty">{reason}</p>}

      {eaten && <p className="settings-saved-note">Repas enregistré, bon appétit ! 🎉</p>}

      {!loading && suggestion && !eaten && (
        <div className="meal-suggestion">
          <ul className="meal-item-list">
            {suggestion.items.map((item) => (
              <li className="meal-item-row" key={item.fridgeItemId}>
                <span className="meal-item-name">{item.name}</span>
                <span className="meal-item-qty">
                  {item.quantity} {item.unit}
                </span>
                <span className="meal-item-macros">{item.calories} kcal</span>
              </li>
            ))}
          </ul>

          <div className="meal-suggestion-totals">
            <div>
              <strong>{suggestion.totals.calories}</strong> kcal
            </div>
            <div>
              <strong>{suggestion.totals.protein}</strong> g protéines
            </div>
            <div>
              <strong>{suggestion.totals.fat}</strong> g lipides
            </div>
            <div>
              <strong>{suggestion.totals.carbs}</strong> g glucides
            </div>
          </div>

          <div className="scan-actions">
            <button className="auth-submit" onClick={handleEat} disabled={eating}>
              {eating ? "Enregistrement…" : "✅ Manger ce repas"}
            </button>
            <button className="logout-button" onClick={regenerate} disabled={eating}>
              🔄 Autre suggestion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
