import { useEffect, useMemo, useState } from "react";
import { getFridgeItems } from "./api.js";
import type { FridgeItem } from "./api.js";

type GroupedItems = Record<string, Record<string, FridgeItem[]>>;

function groupItems(items: FridgeItem[]): GroupedItems {
  const grouped: GroupedItems = {};
  for (const item of items) {
    grouped[item.category] ??= {};
    grouped[item.category][item.subcategory] ??= [];
    grouped[item.category][item.subcategory].push(item);
  }
  return grouped;
}

export default function FridgePage({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<FridgeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    getFridgeItems()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));
  }, []);

  const grouped = useMemo(() => groupItems(items ?? []), [items]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="fridge-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>🧊 Frigo</h2>

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
                  return (
                    <div className="fridge-subcategory" key={subcategory}>
                      <div className="fridge-subcategory-header" onClick={() => toggle(subKey)}>
                        <span>{subcategory}</span>
                        <span className={`chevron ${subExpanded ? "expanded" : ""}`}>▸</span>
                      </div>
                      {subExpanded && (
                        <ul className="fridge-item-list">
                          {subItems.map((item) => {
                            const itemKey = `item:${item.id}`;
                            const itemExpanded = expanded.has(itemKey);
                            return (
                              <li key={item.id}>
                                <div className="fridge-item-row" onClick={() => toggle(itemKey)}>
                                  <span>{item.name}</span>
                                  <span>
                                    {item.quantity} {item.unit}
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
