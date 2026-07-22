import { useEffect, useState } from "react";
import { getMealSuggestion, markItemEaten, getRecipeSuggestion, logManualConsumption } from "./api.js";
import type { MealSlot, MealSuggestion, RecipeMatch } from "./api.js";

type Source = "fridge" | "recipe";

const SLOT_LABELS: Record<MealSlot, string> = {
  "petit-dejeuner": "🌅 Petit-déjeuner",
  dejeuner: "☀️ Déjeuner",
  diner: "🌙 Dîner",
};

// Créneau suggéré par défaut selon l'heure locale du navigateur — seuils
// arbitraires (pas un repère scientifique), l'utilisateur peut toujours
// changer avant de générer une suggestion.
function defaultSlotFromHour(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 11) return "petit-dejeuner";
  if (hour < 16) return "dejeuner";
  return "diner";
}

export default function MealBuilderPage({ onBack }: { onBack: () => void }) {
  const [source, setSource] = useState<Source>("fridge");
  const [slot, setSlot] = useState<MealSlot>(defaultSlotFromHour);
  const [suggestion, setSuggestion] = useState<MealSuggestion | null>(null);
  const [recipeMatch, setRecipeMatch] = useState<RecipeMatch | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [eating, setEating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eaten, setEaten] = useState(false);
  const [mealsRemaining, setMealsRemaining] = useState(1);

  function load(currentSource: Source, currentSlot: MealSlot, excludeIds: string[] = [], meals = mealsRemaining) {
    setLoading(true);
    setError(null);
    setEaten(false);
    const request =
      currentSource === "fridge"
        ? getMealSuggestion(excludeIds, currentSlot, meals)
        : getRecipeSuggestion(excludeIds, currentSlot, meals);
    request
      .then((result) => {
        if (currentSource === "fridge") {
          setSuggestion((result as { suggestion: MealSuggestion | null }).suggestion);
          setRecipeMatch(null);
        } else {
          setRecipeMatch((result as { match: RecipeMatch | null }).match);
          setSuggestion(null);
        }
        setReason(result.reason ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(source, slot), []);

  function changeSource(next: Source) {
    if (next === source) return;
    setSource(next);
    setSuggestion(null);
    setRecipeMatch(null);
    load(next, slot, []);
  }

  function changeSlot(next: MealSlot) {
    if (next === slot) return;
    setSlot(next);
    setSuggestion(null);
    setRecipeMatch(null);
    load(source, next, []);
  }

  function changeMealsRemaining(value: number) {
    const clamped = Math.min(6, Math.max(1, value));
    setMealsRemaining(clamped);
    load(source, slot, [], clamped);
  }

  async function handleEat() {
    setEating(true);
    setError(null);
    try {
      if (source === "fridge" && suggestion) {
        for (const item of suggestion.items) {
          await markItemEaten(item.fridgeItemId, item.quantity, slot);
        }
      } else if (source === "recipe" && recipeMatch) {
        await logManualConsumption(
          {
            name: recipeMatch.recipeName,
            quantity: 1,
            unit: "portion",
            calories: recipeMatch.totals.calories,
            protein: recipeMatch.totals.protein,
            fat: recipeMatch.totals.fat,
            carbs: recipeMatch.totals.carbs,
          },
          slot
        );
      }
      setEaten(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setEating(false);
    }
  }

  function regenerate() {
    if (source === "fridge" && suggestion) {
      load(source, slot, suggestion.items.map((i) => i.fridgeItemId));
    } else if (source === "recipe" && recipeMatch) {
      load(source, slot, [recipeMatch.recipeId]);
    }
  }

  const hasResult = source === "fridge" ? !!suggestion : !!recipeMatch;
  const totals = source === "fridge" ? suggestion?.totals : recipeMatch?.totals;

  return (
    <div className="meal-builder-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>🍳 Composer un repas</h2>
      <p className="wizard-hint">Une suggestion basée sur {source === "fridge" ? "ton frigo" : "les recettes de la communauté"} et ce qu'il te reste à atteindre aujourd'hui.</p>

      <div className="meal-slot-tabs">
        {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
          <button key={s} className={slot === s ? "active" : ""} onClick={() => changeSlot(s)}>
            {SLOT_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="meal-source-tabs">
        <button className={source === "fridge" ? "active" : ""} onClick={() => changeSource("fridge")}>
          🧊 Depuis mon frigo
        </button>
        <button className={source === "recipe" ? "active" : ""} onClick={() => changeSource("recipe")}>
          📖 Depuis une recette
        </button>
      </div>

      <div className="meals-remaining-control">
        <span>Repas sur ce créneau (dont celui-ci) :</span>
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

      {!loading && !hasResult && reason && <p className="fridge-empty">{reason}</p>}

      {eaten && <p className="settings-saved-note">Repas enregistré, bon appétit ! 🎉</p>}

      {!loading && source === "fridge" && suggestion && !eaten && (
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
        </div>
      )}

      {!loading && source === "recipe" && recipeMatch && !eaten && (
        <div className="meal-suggestion">
          <h3 className="recipe-match-name">{recipeMatch.recipeName}</h3>
          <ul className="meal-item-list">
            {recipeMatch.ingredients.map((item, index) => (
              <li className="meal-item-row" key={`${item.name}-${index}`}>
                <span className="meal-item-name">
                  {item.name}
                  {item.flexible && <span className="recipe-flexible-tag">libre</span>}
                </span>
                <span className="meal-item-qty">
                  {item.displayQuantity} {item.displayUnit}
                </span>
                <span className="meal-item-macros">{item.calories} kcal</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && hasResult && totals && !eaten && (
        <>
          <div className="meal-suggestion-totals">
            <div>
              <strong>{totals.calories}</strong> kcal
            </div>
            <div>
              <strong>{totals.protein}</strong> g protéines
            </div>
            <div>
              <strong>{totals.fat}</strong> g lipides
            </div>
            <div>
              <strong>{totals.carbs}</strong> g glucides
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
        </>
      )}
    </div>
  );
}
