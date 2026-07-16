import { useState } from "react";
import { createFridgeItem, updateFridgeItem } from "./api.js";
import type { FridgeItem, FridgeItemDraft } from "./api.js";
import { DISPLAY_CATEGORIES, CATEGORY_NUTRITION_DEFAULTS } from "./fridgeCategories.js";
import type { DisplayCategory } from "./fridgeCategories.js";

function emptyDraft(): FridgeItemDraft {
  return {
    name: "",
    category: DISPLAY_CATEGORIES[0],
    subcategory: "",
    quantity: 1,
    unit: "pièce",
    expiresAt: null,
    ...CATEGORY_NUTRITION_DEFAULTS[DISPLAY_CATEGORIES[0]],
    nutritionEstimated: false,
  };
}

function toDraft(item: FridgeItem): FridgeItemDraft {
  return {
    barcode: item.barcode,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    quantity: item.quantity,
    unit: item.unit,
    expiresAt: item.expiresAt.slice(0, 10),
    caloriesPer100g: item.caloriesPer100g,
    proteinPer100g: item.proteinPer100g,
    fatPer100g: item.fatPer100g,
    carbsPer100g: item.carbsPer100g,
    nutritionEstimated: item.nutritionEstimated,
  };
}

export default function FridgeItemFormPage({
  item,
  onSaved,
  onCancel,
}: {
  item: FridgeItem | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<FridgeItemDraft>(item ? toDraft(item) : emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<FridgeItemDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function handleCategoryChange(category: string) {
    const defaults = CATEGORY_NUTRITION_DEFAULTS[category as DisplayCategory] ?? CATEGORY_NUTRITION_DEFAULTS.Autre;
    update({ category, ...defaults });
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      if (item) {
        await updateFridgeItem(item.id, draft);
      } else {
        await createFridgeItem(draft);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setSaving(false);
    }
  }

  const canSubmit = draft.name.trim().length > 0 && draft.subcategory.trim().length > 0 && !!draft.expiresAt;

  return (
    <div className="fridge-item-form">
      <h3>{item ? "Modifier l'article" : "Ajouter un aliment"}</h3>

      <div className="auth-form">
        <label>
          Nom
          <input type="text" value={draft.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label>
          Catégorie
          <select value={draft.category} onChange={(e) => handleCategoryChange(e.target.value)}>
            {DISPLAY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sous-catégorie
          <input
            type="text"
            value={draft.subcategory}
            onChange={(e) => update({ subcategory: e.target.value })}
            placeholder="ex. Bœuf, Chèvre, Pomme…"
          />
        </label>
        <label>
          Quantité
          <input
            type="number"
            min="0"
            step="any"
            value={draft.quantity}
            onChange={(e) => update({ quantity: Number(e.target.value) })}
          />
        </label>
        <label>
          Unité
          <input type="text" value={draft.unit} onChange={(e) => update({ unit: e.target.value })} />
        </label>
        <label>
          Date de péremption
          <input
            type="date"
            value={draft.expiresAt ?? ""}
            onChange={(e) => update({ expiresAt: e.target.value || null })}
            required
          />
        </label>
      </div>

      <p className="scan-hint">
        Valeurs nutritionnelles pour 100g — préremplies selon la catégorie, à ajuster si tu connais les vraies valeurs.
      </p>
      <div className="auth-form">
        <label>
          Calories (kcal)
          <input
            type="number"
            min="0"
            step="any"
            value={draft.caloriesPer100g}
            onChange={(e) => update({ caloriesPer100g: Number(e.target.value) })}
          />
        </label>
        <label>
          Protéines (g)
          <input
            type="number"
            min="0"
            step="any"
            value={draft.proteinPer100g}
            onChange={(e) => update({ proteinPer100g: Number(e.target.value) })}
          />
        </label>
        <label>
          Lipides (g)
          <input
            type="number"
            min="0"
            step="any"
            value={draft.fatPer100g}
            onChange={(e) => update({ fatPer100g: Number(e.target.value) })}
          />
        </label>
        <label>
          Glucides (g)
          <input
            type="number"
            min="0"
            step="any"
            value={draft.carbsPer100g}
            onChange={(e) => update({ carbsPer100g: Number(e.target.value) })}
          />
        </label>
      </div>

      {error && <p className="fridge-error">{error}</p>}

      <div className="scan-actions">
        <button className="auth-submit" onClick={handleSubmit} disabled={saving || !canSubmit}>
          {saving ? "Enregistrement…" : item ? "Enregistrer les modifications" : "Ajouter au frigo"}
        </button>
        <button className="logout-button" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
      </div>
    </div>
  );
}
