import { useEffect, useMemo, useState } from "react";
import { deleteFridgeItem, getFridgeItems, markItemEaten } from "./api.js";
import type { FridgeItem } from "./api.js";
import FridgeItemFormPage from "./FridgeItemFormPage.js";
import { useToast } from "./ToastProvider.js";
import Skeleton from "./Skeleton.js";
import CategoryIconTile from "./CategoryIconTile.js";
import DishIconTile from "./DishIconTile.js";

type GroupedItems = Record<string, Record<string, FridgeItem[]>>;
type SortBy = "expiration" | "weight" | "name";

function groupItems(items: FridgeItem[]): GroupedItems {
  const grouped: GroupedItems = {};
  for (const item of items) {
    grouped[item.category] ??= {};
    grouped[item.category][item.subcategory] ??= [];
    grouped[item.category][item.subcategory].push(item);
  }
  return grouped;
}

function sortItems(items: FridgeItem[], sortBy: SortBy): FridgeItem[] {
  const copy = [...items];
  switch (sortBy) {
    case "expiration":
      return copy.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
    case "weight":
      return copy.sort((a, b) => a.quantity - b.quantity);
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function formatExpiry(expiresAt: string): { label: string; urgency: "expired" | "soon" | "" } {
  const diffDays = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const date = new Date(expiresAt).toLocaleDateString("fr-FR");
  if (diffDays < 0) return { label: `Expiré (${date})`, urgency: "expired" };
  if (diffDays <= 3) return { label: `Expire bientôt (${date})`, urgency: "soon" };
  return { label: date, urgency: "" };
}

// Résumé quantité visible directement sur la tuile catégorie, sans avoir à
// cliquer — regroupe par unité (g/kg/pièce/ml...) plutôt que de sommer des
// unités incompatibles entre elles.
function formatCategorySummary(items: FridgeItem[]): string {
  const byUnit = new Map<string, number>();
  for (const item of items) {
    byUnit.set(item.unit, (byUnit.get(item.unit) ?? 0) + item.quantity);
  }
  const parts = Array.from(byUnit.entries()).map(([unit, total]) =>
    unit === "g" && total >= 1000 ? `${(total / 1000).toFixed(1)} kg` : `${Math.round(total * 10) / 10} ${unit}`
  );
  return `${items.length} article${items.length > 1 ? "s" : ""} · ${parts.join(" · ")}`;
}

type Mode = "list" | "add" | "edit";

export default function FridgePage({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<FridgeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>("expiration");
  const [mode, setMode] = useState<Mode>("list");
  const [editingItem, setEditingItem] = useState<FridgeItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [eatingId, setEatingId] = useState<string | null>(null);
  const [eatQuantity, setEatQuantity] = useState(0);
  const [eatError, setEatError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (error) showToast(error);
  }, [error, showToast]);

  useEffect(() => {
    if (deleteError) showToast(deleteError);
  }, [deleteError, showToast]);

  useEffect(() => {
    if (eatError) showToast(eatError);
  }, [eatError, showToast]);

  function reload() {
    getFridgeItems()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));
  }

  useEffect(reload, []);

  const grouped = useMemo(() => groupItems(items ?? []), [items]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSaved() {
    setMode("list");
    setEditingItem(null);
    reload();
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    try {
      await deleteFridgeItem(id);
      setConfirmDeleteId(null);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  function startEat(item: FridgeItem) {
    setEatingId(item.id);
    setEatQuantity(item.quantity);
    setEatError(null);
  }

  async function handleEat(item: FridgeItem) {
    setEatError(null);
    try {
      await markItemEaten(item.id, eatQuantity);
      setEatingId(null);
      reload();
    } catch (err) {
      setEatError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  if (mode === "add") {
    return (
      <div className="fridge-page">
        <button className="page-back" onClick={() => setMode("list")}>
          ← Retour
        </button>
        <FridgeItemFormPage item={null} onSaved={handleSaved} onCancel={() => setMode("list")} />
      </div>
    );
  }

  if (mode === "edit" && editingItem) {
    return (
      <div className="fridge-page">
        <button className="page-back" onClick={() => setMode("list")}>
          ← Retour
        </button>
        <FridgeItemFormPage item={editingItem} onSaved={handleSaved} onCancel={() => setMode("list")} />
      </div>
    );
  }

  return (
    <div className="fridge-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <div className="fridge-toolbar">
        <h2>🧊 Frigo</h2>
        <button className="fridge-add-button" onClick={() => setMode("add")}>
          + Ajouter un aliment
        </button>
      </div>

      {items !== null && items.length > 0 && (
        <div className="fridge-sort-control">
          <label>
            Trier par :{" "}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="expiration">Date de péremption</option>
              <option value="weight">Poids</option>
              <option value="name">Nom</option>
            </select>
          </label>
        </div>
      )}

      {items === null && !error && (
        <div className="skeleton-stack">
          <Skeleton height="20px" width="40%" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      )}
      {items !== null && items.length === 0 && (
        <p className="fridge-empty">Ton frigo est vide pour l'instant.</p>
      )}

      {items !== null && items.length > 0 && (
        <div className="fridge-category-grid">
          {Object.entries(grouped).map(([category, subcategories]) => {
            const catKey = `cat:${category}`;
            const catExpanded = expanded.has(catKey);
            const flatItems = Object.values(subcategories).flat();
            const distinctNames = Array.from(new Set(flatItems.map((i) => i.name)));
            const shownNames = distinctNames.slice(0, 5);
            const extraCount = distinctNames.length - shownNames.length;
            return (
              <button
                className={`fridge-category-tile ${catExpanded ? "expanded" : ""}`}
                onClick={() => toggle(catKey)}
                key={category}
              >
                <CategoryIconTile category={category} size={40} />
                <span className="fridge-category-tile-name">{category}</span>
                <span className="fridge-category-tile-summary">{formatCategorySummary(flatItems)}</span>
                <span className="fridge-category-tile-icons">
                  {shownNames.map((name) => (
                    <DishIconTile key={name} name={name} size={22} />
                  ))}
                  {extraCount > 0 && <span className="fridge-category-tile-more">+{extraCount}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {Object.entries(grouped).map(([category, subcategories]) => {
        const catKey = `cat:${category}`;
        const catExpanded = expanded.has(catKey);
        if (!catExpanded) return null;
        return (
          <div className="fridge-category-detail" key={category}>
            <div className="fridge-category-detail-header">
              <span>{category}</span>
              <button className="fridge-category-collapse" onClick={() => toggle(catKey)}>
                ✕ Réduire
              </button>
            </div>
            {catExpanded && (
              <div className="fridge-subcategory-list">
                {Object.entries(subcategories).map(([subcategory, subItems]) => {
                  const subKey = `sub:${category}>${subcategory}`;
                  const subExpanded = expanded.has(subKey);
                  const sortedItems = sortItems(subItems, sortBy);
                  return (
                    <div className="fridge-subcategory" key={subcategory}>
                      <div className="fridge-subcategory-header" onClick={() => toggle(subKey)}>
                        <span>{subcategory}</span>
                        <span className={`chevron ${subExpanded ? "expanded" : ""}`}>▸</span>
                      </div>
                      {subExpanded && (
                        <ul className="fridge-item-list">
                          {sortedItems.map((item) => {
                            const itemKey = `item:${item.id}`;
                            const itemExpanded = expanded.has(itemKey);
                            const expiry = formatExpiry(item.expiresAt);
                            return (
                              <li key={item.id}>
                                <div className="fridge-item-row" onClick={() => toggle(itemKey)}>
                                  <CategoryIconTile category={item.category} size={36} />
                                  <span className="fridge-item-name">{item.name}</span>
                                  <span className="fridge-item-meta">
                                    <span className={`fridge-expiry ${expiry.urgency}`}>{expiry.label}</span>
                                    <span>
                                      {item.quantity} {item.unit}
                                    </span>
                                    <span className={`chevron ${itemExpanded ? "expanded" : ""}`}>▸</span>
                                  </span>
                                </div>
                                {itemExpanded && (
                                  <div className="fridge-item-detail">
                                    <div className="fridge-item-nutrition">
                                      <span>{item.caloriesPer100g} kcal</span>
                                      <span>{item.proteinPer100g} g protéines</span>
                                      <span>{item.fatPer100g} g lipides</span>
                                      <span>{item.carbsPer100g} g glucides</span>
                                    </div>
                                    <span className="fridge-item-nutrition-note">pour 100g</span>
                                    {item.nutritionEstimated && (
                                      <span className="fridge-item-estimated-badge">Estimé</span>
                                    )}
                                    {eatingId === item.id ? (
                                      <div className="fridge-eat-form" onClick={(e) => e.stopPropagation()}>
                                        <label>
                                          Quantité mangée ({item.unit})
                                          <input
                                            type="number"
                                            min="0"
                                            max={item.quantity}
                                            step="any"
                                            value={eatQuantity}
                                            onChange={(e) => setEatQuantity(Number(e.target.value))}
                                          />
                                        </label>
                                        <div className="fridge-item-actions">
                                          <button
                                            className="fridge-item-action-button confirm eat"
                                            onClick={() => handleEat(item)}
                                            disabled={eatQuantity <= 0 || eatQuantity > item.quantity}
                                          >
                                            Confirmer
                                          </button>
                                          <button className="fridge-item-action-button" onClick={() => setEatingId(null)}>
                                            Annuler
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                    <div className="fridge-item-actions" onClick={(e) => e.stopPropagation()}>
                                      <button className="fridge-item-action-button eat" onClick={() => startEat(item)}>
                                        🍴 Manger
                                      </button>
                                      <button
                                        className="fridge-item-action-button"
                                        onClick={() => {
                                          setEditingItem(item);
                                          setMode("edit");
                                        }}
                                      >
                                        ✏️ Modifier
                                      </button>
                                      {confirmDeleteId === item.id ? (
                                        <>
                                          <button
                                            className="fridge-item-action-button confirm"
                                            onClick={() => handleDelete(item.id)}
                                          >
                                            Confirmer la suppression
                                          </button>
                                          <button
                                            className="fridge-item-action-button"
                                            onClick={() => setConfirmDeleteId(null)}
                                          >
                                            Annuler
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          className="fridge-item-action-button danger"
                                          onClick={() => setConfirmDeleteId(item.id)}
                                        >
                                          🗑️ Supprimer
                                        </button>
                                      )}
                                    </div>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
