import { useEffect, useState } from "react";
import { confirmWeekPlanEntrySwap, previewWeekPlanEntrySwap } from "./api.js";
import type { RecipeMatch, WeekPlan } from "./api.js";

export default function SwapSheet({
  entryId,
  initialMatch,
  slotLabel,
  onCancel,
  onConfirmed,
}: {
  entryId: string;
  initialMatch: RecipeMatch;
  slotLabel: string;
  onCancel: () => void;
  onConfirmed: (weekPlan: WeekPlan | null, reason?: string) => void;
}) {
  const [excluded, setExcluded] = useState<string[]>([]);
  const [preview, setPreview] = useState<RecipeMatch | null | undefined>(initialMatch);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (excluded.length === 0) {
      setPreview(initialMatch);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    previewWeekPlanEntrySwap(entryId, excluded)
      .then((result) => {
        if (cancelled) return;
        setPreview(result.match);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excluded, entryId]);

  function toggleIngredient(name: string) {
    setExcluded((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  async function handleConfirm() {
    if (!preview) return;
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmWeekPlanEntrySwap(entryId, preview.recipeId);
      onConfirmed(result.weekPlan, result.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setConfirming(false);
    }
  }

  // Les chips reflètent toujours la recette actuellement prévisualisée :
  // exclure un ingrédient peut faire apparaître une nouvelle recette dont
  // les ingrédients propres doivent devenir à leur tour cliquables.
  const chipSource = preview ?? initialMatch;

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <div>
            <span className="sheet-slot-label">{slotLabel}</span>
            <h3>🔄 Échanger un ingrédient</h3>
          </div>
          <button className="sheet-close" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <p className="wizard-hint">
          Sélectionne les ingrédients que tu n'as pas ou ne veux pas manger : une autre recette compatible sera
          proposée à la place. Ce choix ne modifie jamais tes préférences apprises.
        </p>

        <ul className="swap-chip-list">
          {chipSource.ingredients.map((ing) => {
            const isExcluded = excluded.some((n) => n.toLowerCase() === ing.name.toLowerCase());
            return (
              <li key={ing.name}>
                <button
                  type="button"
                  className={`swap-chip ${isExcluded ? "excluded" : ""}`}
                  onClick={() => toggleIngredient(ing.name)}
                >
                  {isExcluded ? "🚫 " : ""}
                  {ing.name}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="swap-preview">
          {loading && <p className="scan-status">Recherche d'une alternative…</p>}
          {!loading && preview && (
            <>
              <h4>{preview.recipeName}</h4>
              <p className="meal-suggestion-totals">
                <span>
                  <strong>{preview.totals.calories}</strong> kcal
                </span>
                <span>{preview.totals.protein} g protéines</span>
                <span>{preview.totals.fat} g lipides</span>
                <span>{preview.totals.carbs} g glucides</span>
              </p>
            </>
          )}
          {!loading && preview === null && (
            <p className="fridge-empty">Aucune autre recette compatible avec ces exclusions.</p>
          )}
        </div>

        <div className="week-plan-review-actions">
          <button className="week-plan-review-reject" onClick={onCancel} disabled={confirming}>
            Annuler
          </button>
          <button className="week-plan-review-accept" onClick={() => void handleConfirm()} disabled={!preview || confirming || loading}>
            {confirming ? "…" : "✅ Valider ce repas"}
          </button>
        </div>
        {error && <p className="fridge-error">{error}</p>}
      </div>
    </div>
  );
}
