import { useEffect, useMemo, useState } from "react";
import { deleteFridgeItem, getFridgeItems } from "./api.js";
import type { FridgeItem } from "./api.js";
import FridgeItemFormPage from "./FridgeItemFormPage.js";

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

      {deleteError && <p className="fridge-error">{deleteError}</p>}
      {items === null && !error && <p>Chargement…</p>}
      {error && <p className="fridge-error">{error}</p>}
      {items !== null && items.length === 0 && (
        <p className="fridge-empty">Ton frigo est vide pour l'instant.</p>
      )}

      {Object.entries(grouped).map(([category, subcategories]) => {
        const catKey = `cat:${category}`;
        const catExpanded = expanded.has(catKey);
        return (
          <div className="fridge-category" key={category}>
            <div className="fridge-category-header" onClick={() => toggle(catKey)}>
              <span>{category}</span>
              <span className={`chevron ${catExpanded ? "expanded" : ""}`}>▸</span>
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
                                  <span>{item.name}</span>
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
                                    <div className="fridge-item-actions" onClick={(e) => e.stopPropagation()}>
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
