import { useEffect, useState } from "react";
import {
  getConsumptionEntries,
  getFridgeItems,
  getMealSuggestion,
  getRecipeSuggestion,
  logManualConsumption,
  markItemEaten,
} from "./api.js";
import type { ConsumptionEntry, FridgeItem, MealSlot, MissingIngredient } from "./api.js";
import Card from "./Card.js";
import MealDetailSheet from "./MealDetailSheet.js";
import DishIconTile from "./DishIconTile.js";
import { useToast } from "./ToastProvider.js";

const SLOT_LABELS: Record<MealSlot, string> = {
  "petit-dejeuner": "🌅 Petit-déjeuner",
  dejeuner: "☀️ Déjeuner",
  diner: "🌙 Dîner",
};

export interface SlotMealItem {
  fridgeItemId: string | null;
  name: string;
  quantity: number;
  unit: string;
}

// `source` distingue un repas composé uniquement à partir du frigo
// (mealBuilder.ts, tous les items ont un fridgeItemId) d'un repas de repli
// piochée dans les recettes communautaires quand le frigo seul ne suffit
// pas à composer un repas complet pour ce créneau — dans ce cas
// `missingIngredients` liste ce qu'il manque pour la préparer réellement.
export interface SlotMealData {
  slot: MealSlot;
  kind: "eaten" | "proposed" | "empty";
  source: "fridge" | "recipe" | null;
  recipeId: string | null;
  name: string;
  reason?: string;
  totals: { calories: number; protein: number; fat: number; carbs: number };
  items: SlotMealItem[];
  missingIngredients: MissingIngredient[];
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayEnd(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function sumTotals(entries: ConsumptionEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      fat: acc.fat + e.fat,
      carbs: acc.carbs + e.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

// Compose la proposition d'UN créneau : essaie d'abord uniquement le frigo
// (mealBuilder.ts) — jamais de recette tant que le frigo seul suffit, par
// choix produit explicite (toutes les fonctions de composition doivent
// privilégier le stock réellement disponible). Si le frigo ne peut rien
// proposer, retombe sur la meilleure recette communautaire compatible et
// expose ce qu'il manque pour la préparer (missingIngredients), plutôt que
// de laisser le créneau vide sans piste.
async function suggestSlot(
  slot: MealSlot,
  excludeFridgeIds: string[] = [],
  excludeRecipeIds: string[] = []
): Promise<SlotMealData> {
  try {
    const { suggestion, reason } = await getMealSuggestion(excludeFridgeIds, slot, 1);
    if (suggestion) {
      return {
        slot,
        kind: "proposed",
        source: "fridge",
        recipeId: null,
        name: suggestion.items.map((i) => i.name).join(", ") || "Repas proposé",
        totals: suggestion.totals,
        items: suggestion.items.map((i) => ({
          fridgeItemId: i.fridgeItemId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
        })),
        missingIngredients: [],
      };
    }

    const { match, reason: recipeReason } = await getRecipeSuggestion(excludeRecipeIds, slot, 1);
    if (match) {
      return {
        slot,
        kind: "proposed",
        source: "recipe",
        recipeId: match.recipeId,
        name: match.recipeName,
        totals: match.totals,
        items: match.ingredients.map((i) => ({ fridgeItemId: null, name: i.name, quantity: i.displayQuantity, unit: i.displayUnit })),
        missingIngredients: [],
      };
    }

    return {
      slot,
      kind: "empty",
      source: null,
      recipeId: null,
      name: recipeReason ?? reason ?? "Pas de repas possible pour ce créneau.",
      totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      items: [],
      missingIngredients: [],
    };
  } catch {
    return {
      slot,
      kind: "empty",
      source: null,
      recipeId: null,
      name: "Impossible de générer une suggestion.",
      totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      items: [],
      missingIngredients: [],
    };
  }
}

export default function DayOverview() {
  const [slots, setSlots] = useState<SlotMealData[] | null>(null);
  const [fridgeItems, setFridgeItems] = useState<FridgeItem[]>([]);
  const [selected, setSelected] = useState<SlotMealData | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function load() {
    const today = new Date();
    const [entries, items] = await Promise.all([
      getConsumptionEntries(dayStart(today).toISOString(), dayEnd(today).toISOString()).catch(() => []),
      getFridgeItems().catch(() => []),
    ]);
    setFridgeItems(items);

    const bySlot: Record<MealSlot, ConsumptionEntry[]> = {
      "petit-dejeuner": [],
      dejeuner: [],
      diner: [],
    };
    for (const e of entries) {
      if (e.mealSlot) bySlot[e.mealSlot].push(e);
    }

    const results: SlotMealData[] = [];
    for (const slot of ["petit-dejeuner", "dejeuner", "diner"] as MealSlot[]) {
      const eaten = bySlot[slot];
      if (eaten.length > 0) {
        results.push({
          slot,
          kind: "eaten",
          source: null,
          recipeId: null,
          name: eaten.map((e) => e.name).join(", "),
          totals: sumTotals(eaten),
          items: eaten.map((e) => ({ fridgeItemId: e.fridgeItemId, name: e.name, quantity: e.quantity, unit: e.unit })),
          missingIngredients: [],
        });
        continue;
      }
      results.push(await suggestSlot(slot));
    }

    setSlots(results);
    return results;
  }

  useEffect(() => {
    load();
  }, []);

  function updateSelected(next: SlotMealData) {
    setSelected(next);
    setSlots((prev) => (prev ? prev.map((s) => (s.slot === next.slot ? next : s)) : prev));
  }

  async function handleReroll(current: SlotMealData) {
    setBusy(true);
    try {
      const excludeFridgeIds = current.source === "fridge" ? current.items.map((i) => i.fridgeItemId).filter((id): id is string => !!id) : [];
      const excludeRecipeIds = current.source === "recipe" && current.recipeId ? [current.recipeId] : [];
      const next = await suggestSlot(current.slot, excludeFridgeIds, excludeRecipeIds);
      updateSelected(next);
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkEaten(current: SlotMealData) {
    setBusy(true);
    try {
      if (current.source === "fridge") {
        for (const item of current.items) {
          if (item.fridgeItemId) await markItemEaten(item.fridgeItemId, item.quantity, current.slot);
        }
      } else {
        await logManualConsumption(
          { name: current.name, quantity: 1, unit: "portion", ...current.totals },
          current.slot
        );
      }
      setSelected(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  if (!slots) return null;

  return (
    <>
      <Card className="day-overview">
        <h3>Aujourd'hui</h3>
        <ul className="day-overview-list">
          {slots.map((s) => (
            <li
              key={s.slot}
              className={`day-overview-row ${s.kind}`}
              onClick={() => (s.kind !== "empty" ? setSelected(s) : undefined)}
            >
              {s.kind !== "empty" && <DishIconTile name={s.name} size={36} />}
              <div className="day-overview-text">
                <span className="day-overview-slot">{SLOT_LABELS[s.slot]}</span>
                <span className="day-overview-name">{s.name}</span>
              </div>
              {s.kind === "proposed" && <span className="day-overview-status">à confirmer</span>}
              <span className="day-overview-cal">{s.kind === "empty" ? "—" : `${Math.round(s.totals.calories)} kcal`}</span>
            </li>
          ))}
        </ul>
      </Card>

      {selected && (
        <MealDetailSheet
          slotData={selected}
          fridgeItems={fridgeItems}
          slotLabel={SLOT_LABELS[selected.slot]}
          busy={busy}
          onClose={() => setSelected(null)}
          onReroll={selected.kind === "proposed" ? () => void handleReroll(selected) : undefined}
          onMarkEaten={selected.kind === "proposed" ? () => void handleMarkEaten(selected) : undefined}
        />
      )}
    </>
  );
}
