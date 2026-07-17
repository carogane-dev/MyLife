import { useEffect, useState } from "react";
import {
  getRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  toggleRecipeLike,
} from "./api.js";
import type { RecipeSummary, RecipeDetail, RecipeDraft, RecipeIngredient, RecipeFilters } from "./api.js";

const CATEGORIES = ["Petit-déjeuner", "Plat", "Entrée", "Dessert", "Snack"];
const DIFFICULTIES = ["facile", "moyen", "difficile"];
const DIFFICULTY_STARS: Record<string, string> = { facile: "★☆☆", moyen: "★★☆", difficile: "★★★" };

type Mode = "list" | "detail" | "create" | "edit";

function emptyIngredient(): RecipeIngredient {
  return {
    name: "",
    displayQuantity: 1,
    displayUnit: "g",
    referenceGrams: 100,
    caloriesPer100g: 0,
    proteinPer100g: 0,
    fatPer100g: 0,
    carbsPer100g: 0,
    flexible: false,
  };
}

function emptyDraft(): RecipeDraft {
  return {
    name: "",
    description: "",
    instructions: "",
    category: CATEGORIES[1],
    healthy: false,
    difficulty: "facile",
    prepMinutes: 10,
    cookMinutes: 10,
    servings: 2,
    ingredients: [emptyIngredient()],
  };
}

function toDraft(recipe: RecipeDetail): RecipeDraft {
  return {
    name: recipe.name,
    description: recipe.description ?? "",
    instructions: recipe.instructions,
    category: recipe.category,
    healthy: recipe.healthy,
    difficulty: recipe.difficulty,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    servings: recipe.servings,
    ingredients: recipe.ingredients.map((i) => ({ ...i })),
  };
}

export default function RecipesPage({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("list");
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RecipeFilters>({ sort: "likes" });
  const [selected, setSelected] = useState<RecipeDetail | null>(null);
  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function loadList() {
    setError(null);
    getRecipes(filters)
      .then(setRecipes)
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));
  }

  useEffect(loadList, [filters]);

  function openDetail(id: string) {
    setError(null);
    getRecipe(id)
      .then((recipe) => {
        setSelected(recipe);
        setMode("detail");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));
  }

  async function handleLike(id: string, fromDetail: boolean) {
    try {
      const { liked, likeCount } = await toggleRecipeLike(id);
      if (fromDetail && selected) {
        setSelected({ ...selected, likedByMe: liked, likeCount });
      }
      setRecipes((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, likedByMe: liked, likeCount } : r)) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  function updateDraft(patch: Partial<RecipeDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function updateIngredient(index: number, patch: Partial<RecipeIngredient>) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)),
    }));
  }

  function addIngredient() {
    setDraft((d) => ({ ...d, ingredients: [...d.ingredients, emptyIngredient()] }));
  }

  function removeIngredient(index: number) {
    setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (mode === "edit" && selected) {
        await updateRecipe(selected.id, draft);
      } else {
        await createRecipe(draft);
      }
      setMode("list");
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    try {
      await deleteRecipe(selected.id);
      setMode("list");
      setSelected(null);
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  const canSave =
    draft.name.trim().length > 0 &&
    draft.instructions.trim().length > 0 &&
    draft.ingredients.length > 0 &&
    draft.ingredients.every((i) => i.name.trim().length > 0 && i.displayQuantity > 0 && i.referenceGrams > 0);

  if (mode === "create" || mode === "edit") {
    return (
      <div className="recipes-page">
        <button className="page-back" onClick={() => setMode(selected ? "detail" : "list")}>
          ← Retour
        </button>
        <h2>{mode === "edit" ? "Modifier la recette" : "🍲 Nouvelle recette"}</h2>

        <div className="auth-form">
          <label>
            Nom
            <input type="text" value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })} />
          </label>
          <label>
            Description
            <input type="text" value={draft.description} onChange={(e) => updateDraft({ description: e.target.value })} />
          </label>
          <label>
            Catégorie
            <select value={draft.category} onChange={(e) => updateDraft({ category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulté
            <select value={draft.difficulty} onChange={(e) => updateDraft({ difficulty: e.target.value })}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="recipe-checkbox-label">
            <input type="checkbox" checked={draft.healthy} onChange={(e) => updateDraft({ healthy: e.target.checked })} />
            Recette orientée healthy
          </label>
          <label>
            Préparation (min)
            <input
              type="number"
              min="0"
              value={draft.prepMinutes}
              onChange={(e) => updateDraft({ prepMinutes: Number(e.target.value) })}
            />
          </label>
          <label>
            Cuisson (min)
            <input
              type="number"
              min="0"
              value={draft.cookMinutes}
              onChange={(e) => updateDraft({ cookMinutes: Number(e.target.value) })}
            />
          </label>
          <label>
            Nombre de portions
            <input
              type="number"
              min="1"
              value={draft.servings}
              onChange={(e) => updateDraft({ servings: Number(e.target.value) })}
            />
          </label>
          <label>
            Instructions
            <textarea
              rows={5}
              value={draft.instructions}
              onChange={(e) => updateDraft({ instructions: e.target.value })}
              placeholder="1. ...\n2. ..."
            />
          </label>
        </div>

        <h3>Ingrédients</h3>
        <p className="wizard-hint">
          Coche "libre" pour un ingrédient dont la quantité peut être ajustée pour coller à un objectif nutritionnel
          (ex. poulet, féculent). Laisse décoché pour un ingrédient qui doit garder ses proportions (ex. œufs d'une
          omelette).
        </p>
        {draft.ingredients.map((ing, index) => (
          <div className="recipe-ingredient-row" key={index}>
            <div className="auth-form">
              <label>
                Nom
                <input type="text" value={ing.name} onChange={(e) => updateIngredient(index, { name: e.target.value })} />
              </label>
              <div className="recipe-ingredient-qty-row">
                <label>
                  Quantité affichée
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={ing.displayQuantity}
                    onChange={(e) => updateIngredient(index, { displayQuantity: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Unité affichée
                  <input
                    type="text"
                    value={ing.displayUnit}
                    onChange={(e) => updateIngredient(index, { displayUnit: e.target.value })}
                  />
                </label>
                <label>
                  Poids réel (g)
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={ing.referenceGrams}
                    onChange={(e) => updateIngredient(index, { referenceGrams: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="recipe-ingredient-macro-row">
                <label>
                  Calories/100g
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={ing.caloriesPer100g}
                    onChange={(e) => updateIngredient(index, { caloriesPer100g: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Protéines/100g
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={ing.proteinPer100g}
                    onChange={(e) => updateIngredient(index, { proteinPer100g: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Lipides/100g
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={ing.fatPer100g}
                    onChange={(e) => updateIngredient(index, { fatPer100g: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Glucides/100g
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={ing.carbsPer100g}
                    onChange={(e) => updateIngredient(index, { carbsPer100g: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label className="recipe-checkbox-label">
                <input
                  type="checkbox"
                  checked={ing.flexible}
                  onChange={(e) => updateIngredient(index, { flexible: e.target.checked })}
                />
                Ingrédient libre (quantité ajustable)
              </label>
            </div>
            <button
              className="fridge-item-action-button danger"
              onClick={() => removeIngredient(index)}
              disabled={draft.ingredients.length <= 1}
            >
              🗑️ Retirer cet ingrédient
            </button>
          </div>
        ))}
        <button className="logout-button" onClick={addIngredient}>
          + Ajouter un ingrédient
        </button>

        {error && <p className="fridge-error">{error}</p>}

        <div className="scan-actions">
          <button className="auth-submit" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? "Enregistrement…" : "Enregistrer la recette"}
          </button>
          <button className="logout-button" onClick={() => setMode(selected ? "detail" : "list")} disabled={saving}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (mode === "detail" && selected) {
    return (
      <div className="recipes-page">
        <button className="page-back" onClick={() => setMode("list")}>
          ← Retour
        </button>
        <div className="recipe-detail-header">
          <h2>{selected.name}</h2>
          <button className={`recipe-like-button ${selected.likedByMe ? "liked" : ""}`} onClick={() => handleLike(selected.id, true)}>
            {selected.likedByMe ? "❤️" : "🤍"} {selected.likeCount}
          </button>
        </div>
        <div className="recipe-badges">
          <span className="recipe-badge">{selected.category}</span>
          {selected.healthy && <span className="recipe-badge healthy">🌱 Healthy</span>}
          <span className="recipe-badge">{DIFFICULTY_STARS[selected.difficulty]} {selected.difficulty}</span>
          <span className="recipe-badge">⏱️ {selected.totalMinutes} min</span>
          <span className="recipe-badge">🍽️ {selected.servings} portions</span>
        </div>
        {selected.description && <p className="recipe-description">{selected.description}</p>}

        <div className="meal-suggestion-totals">
          <div>
            <strong>{selected.macrosPerServing.calories}</strong> kcal / portion
          </div>
          <div>
            <strong>{selected.macrosPerServing.protein}</strong> g protéines
          </div>
          <div>
            <strong>{selected.macrosPerServing.fat}</strong> g lipides
          </div>
          <div>
            <strong>{selected.macrosPerServing.carbs}</strong> g glucides
          </div>
        </div>

        <h3>Ingrédients</h3>
        <ul className="recipe-ingredient-list">
          {selected.ingredients.map((ing) => (
            <li key={ing.id ?? ing.name}>
              <span>
                {ing.displayQuantity} {ing.displayUnit} — {ing.name}
              </span>
              {ing.flexible && <span className="recipe-flexible-tag">libre</span>}
            </li>
          ))}
        </ul>

        <h3>Préparation</h3>
        <p className="recipe-instructions">{selected.instructions}</p>

        {error && <p className="fridge-error">{error}</p>}

        {selected.isAuthor && (
          <div className="scan-actions">
            <button
              className="logout-button"
              onClick={() => {
                setDraft(toDraft(selected));
                setMode("edit");
              }}
            >
              ✏️ Modifier
            </button>
            {confirmDelete ? (
              <div className="fridge-item-actions">
                <button className="fridge-item-action-button confirm" onClick={handleDelete}>
                  Confirmer la suppression
                </button>
                <button className="fridge-item-action-button" onClick={() => setConfirmDelete(false)}>
                  Annuler
                </button>
              </div>
            ) : (
              <button className="fridge-item-action-button danger" onClick={() => setConfirmDelete(true)}>
                🗑️ Supprimer
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="recipes-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <div className="fridge-toolbar">
        <h2>🍲 Recettes</h2>
        <button
          className="fridge-add-button"
          onClick={() => {
            setSelected(null);
            setDraft(emptyDraft());
            setMode("create");
          }}
        >
          + Nouvelle recette
        </button>
      </div>

      <div className="recipe-filters">
        <input
          type="text"
          placeholder="Rechercher un nom…"
          value={filters.q ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value || undefined }))}
        />
        <input
          type="text"
          placeholder="Contient l'ingrédient…"
          value={filters.ingredient ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, ingredient: e.target.value || undefined }))}
        />
        <select
          value={filters.category ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filters.difficulty ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value || undefined }))}
        >
          <option value="">Toute difficulté</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={filters.healthy === undefined ? "" : String(filters.healthy)}
          onChange={(e) => setFilters((f) => ({ ...f, healthy: e.target.value === "" ? undefined : e.target.value === "true" }))}
        >
          <option value="">Healthy ou non</option>
          <option value="true">🌱 Healthy seulement</option>
          <option value="false">Classique seulement</option>
        </select>
        <select value={filters.sort ?? "likes"} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as RecipeFilters["sort"] }))}>
          <option value="likes">Les plus aimées</option>
          <option value="time">Les plus rapides</option>
          <option value="recent">Les plus récentes</option>
        </select>
      </div>

      {error && <p className="fridge-error">{error}</p>}
      {recipes === null && !error && <p>Chargement…</p>}
      {recipes !== null && recipes.length === 0 && <p className="fridge-empty">Aucune recette ne correspond à ces filtres.</p>}

      <div className="recipe-grid">
        {recipes?.map((r) => (
          <article className="recipe-card" key={r.id} onClick={() => openDetail(r.id)}>
            <div className="recipe-card-header">
              <h3>{r.name}</h3>
              <button
                className={`recipe-like-button ${r.likedByMe ? "liked" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike(r.id, false);
                }}
              >
                {r.likedByMe ? "❤️" : "🤍"} {r.likeCount}
              </button>
            </div>
            <div className="recipe-badges">
              <span className="recipe-badge">{r.category}</span>
              {r.healthy && <span className="recipe-badge healthy">🌱</span>}
              <span className="recipe-badge">{DIFFICULTY_STARS[r.difficulty]}</span>
              <span className="recipe-badge">⏱️ {r.totalMinutes} min</span>
            </div>
            <p className="recipe-card-macros">
              {r.macrosPerServing.calories} kcal · {r.macrosPerServing.protein}g P · {r.macrosPerServing.fat}g L ·{" "}
              {r.macrosPerServing.carbs}g G <span className="recipe-card-macros-note">/ portion</span>
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
