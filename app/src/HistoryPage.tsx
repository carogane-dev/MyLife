import { useEffect, useState } from "react";
import { getConsumptionEntries } from "./api.js";
import type { ConsumptionEntry, MealSlot } from "./api.js";
import { useToast } from "./ToastProvider.js";
import Skeleton from "./Skeleton.js";

const SLOT_ICONS: Record<MealSlot, string> = {
  "petit-dejeuner": "🌅",
  dejeuner: "☀️",
  diner: "🌙",
};

interface DayGroup {
  key: string;
  label: string;
  totalCalories: number;
  entries: ConsumptionEntry[];
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

function dayLabel(d: Date): string {
  const today = dayStart(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = dayStart(d);

  if (target.getTime() === today.getTime()) return "Aujourd'hui";
  if (target.getTime() === yesterday.getTime()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function groupByDay(entries: ConsumptionEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();

  for (const entry of entries) {
    const d = new Date(entry.consumedAt);
    const key = dayStart(d).toISOString();
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: dayLabel(d), totalCalories: 0, entries: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.entries.push(entry);
    group.totalCalories += entry.calories;
  }

  return groups;
}

const INITIAL_RANGE_DAYS = 30;
const RANGE_STEP_DAYS = 30;

export default function HistoryPage({ onBack }: { onBack: () => void }) {
  const [rangeDays, setRangeDays] = useState(INITIAL_RANGE_DAYS);
  const [entries, setEntries] = useState<ConsumptionEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - rangeDays + 1);

    setLoading(true);
    setError(null);
    getConsumptionEntries(dayStart(from).toISOString(), dayEnd(today).toISOString())
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, [rangeDays]);

  useEffect(() => {
    if (error) showToast(error);
  }, [error, showToast]);

  const groups = entries ? groupByDay(entries) : null;

  return (
    <div className="history-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>📖 Historique</h2>
      <p className="wizard-hint">Tous tes repas journalisés, du plus récent au plus ancien.</p>

      {!groups && loading && (
        <div className="skeleton-stack">
          <Skeleton height="18px" width="30%" />
          <Skeleton height="60px" />
          <Skeleton height="60px" />
        </div>
      )}

      {groups && groups.length === 0 && !loading && (
        <p className="fridge-empty">Aucun repas journalisé sur cette période.</p>
      )}

      {groups && groups.length > 0 && (
        <div className="history-day-list">
          {groups.map((group) => (
            <div className="history-day-group" key={group.key}>
              <div className="history-day-header">
                <h3>{group.label}</h3>
                <span className="history-day-total">{Math.round(group.totalCalories)} kcal</span>
              </div>
              <ul className="history-entry-list">
                {group.entries.map((entry) => (
                  <li key={entry.id} className="history-entry-row">
                    <span className="history-entry-slot">{entry.mealSlot ? SLOT_ICONS[entry.mealSlot] : "🍽️"}</span>
                    <div className="history-entry-main">
                      <span className="history-entry-name">{entry.name}</span>
                      <span className="history-entry-macros">
                        {entry.quantity}
                        {entry.unit} · {Math.round(entry.calories)} kcal · {Math.round(entry.protein)}g P ·{" "}
                        {Math.round(entry.fat)}g L · {Math.round(entry.carbs)}g G
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="scan-actions">
        <button className="logout-button" onClick={() => setRangeDays((d) => d + RANGE_STEP_DAYS)} disabled={loading}>
          {loading ? "Chargement…" : "Voir plus loin dans le temps"}
        </button>
      </div>
    </div>
  );
}
