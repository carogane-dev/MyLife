import type { FridgeItem } from "./api.js";
import type { SlotMealData } from "./DayOverview.js";

export default function MealDetailSheet({
  slotData,
  fridgeItems,
  slotLabel,
  busy,
  onClose,
  onReroll,
  onMarkEaten,
}: {
  slotData: SlotMealData;
  fridgeItems: FridgeItem[];
  slotLabel: string;
  busy?: boolean;
  onClose: () => void;
  onReroll?: () => void;
  onMarkEaten?: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <div>
            <span className="sheet-slot-label">{slotLabel}</span>
            <h3>{slotData.kind === "proposed" ? "Repas proposé" : "Repas"}</h3>
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {slotData.source === "recipe" && slotData.kind === "proposed" && (
          <p className="sheet-recipe-note">
            Ton frigo seul ne suffit pas pour ce créneau — voici la recette la plus proche de ton objectif.
          </p>
        )}

        <div className="sheet-totals">
          <span>{Math.round(slotData.totals.calories)} kcal</span>
          <span>{Math.round(slotData.totals.protein)}g P</span>
          <span>{Math.round(slotData.totals.fat)}g L</span>
          <span>{Math.round(slotData.totals.carbs)}g G</span>
        </div>

        <ul className="sheet-item-list">
          {slotData.items.map((item, idx) => {
            const fridgeItem = item.fridgeItemId ? fridgeItems.find((f) => f.id === item.fridgeItemId) : undefined;
            const remaining = fridgeItem ? Math.max(0, fridgeItem.quantity - item.quantity) : null;
            return (
              <li key={idx} className="sheet-item-row">
                <span className="sheet-item-name">{item.name}</span>
                <span className="sheet-item-used">
                  {item.quantity}
                  {item.unit} utilisé{item.quantity > 1 ? "s" : ""}
                </span>
                <span className="sheet-item-remaining">
                  {slotData.source === "fridge"
                    ? remaining !== null
                      ? `${remaining}${item.unit} restant après ce repas`
                      : "Stock inconnu"
                    : "Recette communautaire"}
                </span>
              </li>
            );
          })}
          {slotData.items.length === 0 && <li className="sheet-item-empty">Aucun détail disponible pour ce repas.</li>}
        </ul>

        {(onReroll || onMarkEaten) && (
          <div className="week-plan-review-actions sheet-actions">
            {onReroll && (
              <button className="week-plan-review-reject" onClick={onReroll} disabled={busy}>
                {busy ? "…" : "🔄 Autre proposition"}
              </button>
            )}
            {onMarkEaten && (
              <button className="week-plan-review-accept" onClick={onMarkEaten} disabled={busy}>
                {busy ? "…" : "✅ J'ai mangé ce repas"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
