import { useEffect, useState } from "react";
import { getConsumptionEntries, getFridgeItems, getMealSuggestion } from "./api.js";
import type { ConsumptionEntry, FridgeItem, MealSlot } from "./api.js";
import Card from "./Card.js";
import MealDetailSheet from "./MealDetailSheet.js";
import DishIconTile from "./DishIconTile.js";

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

export interface SlotMealData {
  slot: MealSlot;
  kind: "eaten" | "proposed" | "empty";
  name: string;
  reason?: string;
  totals: { calories: number; protein: number; fat: number; carbs: number };
  items: SlotMealItem[];
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

export default function DayOverview() {
  const [slots, setSlots] = useState<SlotMealData[] | null>(null);
  const [fridgeItems, setFridgeItems] = useState<FridgeItem[]>([]);
  const [selected, setSelected] = useState<SlotMealData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = new Date();
      const [entries, items] = await Promise.all([
        getConsumptionEntries(dayStart(today).toISOString(), dayEnd(today).toISOString()).catch(() => []),
        getFridgeItems().catch(() => []),
      ]);
      if (cancelled) return;
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
            name: eaten.map((e) => e.name).join(", "),
            totals: sumTotals(eaten),
            items: eaten.map((e) => ({ fridgeItemId: e.fridgeItemId, name: e.name, quantity: e.quantity, unit: e.unit })),
          });
          continue;
        }

        try {
          const { suggestion, reason } = await getMealSuggestion([], slot, 1);
          if (cancelled) return;
          if (suggestion) {
            results.push({
              slot,
              kind: "proposed",
              name: suggestion.items.map((i) => i.name).join(", ") || "Repas proposé",
              totals: suggestion.totals,
              items: suggestion.items.map((i) => ({
                fridgeItemId: i.fridgeItemId,
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
              })),
            });
          } else {
            results.push({
              slot,
              kind: "empty",
              name: reason ?? "Pas de repas possible avec le stock actuel.",
              totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
              items: [],
            });
          }
        } catch {
          if (cancelled) return;
          results.push({
            slot,
            kind: "empty",
            name: "Impossible de générer une suggestion.",
            totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
            items: [],
          });
        }
      }

      if (!cancelled) setSlots(results);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
              <span className="day-overview-cal">{s.kind === "empty" ? "—" : `${Math.round(s.totals.calories)} kcal`}</span>
            </li>
          ))}
        </ul>
      </Card>

      {selected && (
        <MealDetailSheet slotData={selected} fridgeItems={fridgeItems} slotLabel={SLOT_LABELS[selected.slot]} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
