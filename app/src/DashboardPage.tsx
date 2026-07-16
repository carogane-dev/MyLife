import { useEffect, useState } from "react";
import { getConsumptionEntries, getProfile } from "./api.js";
import type { ConsumptionEntry, NutritionProfile } from "./api.js";
import { calculateNutritionTargets } from "./nutritionCalculator.js";
import DailyProgress, { sumConsumption } from "./DailyProgress.js";

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

interface WeekDay {
  key: string;
  label: string;
  calories: number;
}

export default function DashboardPage({ onBack }: { onBack: () => void }) {
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [todayEntries, setTodayEntries] = useState<ConsumptionEntry[] | null>(null);
  const [weekDays, setWeekDays] = useState<WeekDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date();

    getProfile()
      .then(({ profile }) => setProfile(profile))
      .catch(() => setProfile(null));

    getConsumptionEntries(dayStart(today).toISOString(), dayEnd(today).toISOString())
      .then(setTodayEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    getConsumptionEntries(dayStart(weekStart).toISOString(), dayEnd(today).toISOString())
      .then((entries) => {
        const days: WeekDay[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          days.push({ key: d.toDateString(), label: d.toLocaleDateString("fr-FR", { weekday: "short" }), calories: 0 });
        }
        for (const entry of entries) {
          const key = new Date(entry.consumedAt).toDateString();
          const day = days.find((d) => d.key === key);
          if (day) day.calories += entry.calories;
        }
        setWeekDays(days);
      })
      .catch(() => {});
  }, []);

  const targets = profile ? calculateNutritionTargets(profile) : null;
  const todayTotals = todayEntries ? sumConsumption(todayEntries) : null;

  return (
    <div className="dashboard-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>📊 Statistiques</h2>

      {error && <p className="fridge-error">{error}</p>}

      {profile && profile.goalMode === "frigo_only" && (
        <p className="fridge-empty">
          Passe en mode Chill, Rester en forme ou Élite dans les Paramètres pour suivre ta progression calorique.
        </p>
      )}

      {targets && todayTotals && <DailyProgress targets={targets} consumed={todayTotals} />}

      {todayEntries && (
        <div className="consumption-log">
          <h3>Aujourd'hui</h3>
          {todayEntries.length === 0 && <p className="fridge-empty">Rien mangé pour l'instant aujourd'hui.</p>}
          {todayEntries.length > 0 && (
            <ul className="consumption-list">
              {todayEntries.map((entry) => (
                <li key={entry.id}>
                  <span>{entry.name}</span>
                  <span>
                    {entry.quantity}
                    {entry.unit} · {Math.round(entry.calories)} kcal
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {weekDays && targets && (
        <div className="week-chart">
          <h3>Cette semaine</h3>
          <div className="week-chart-bars">
            {weekDays.map((day) => {
              const pct = targets.targetCalories > 0 ? Math.min(100, Math.round((day.calories / targets.targetCalories) * 100)) : 0;
              return (
                <div className="week-bar" key={day.key}>
                  <div className="week-bar-track">
                    <div className="week-bar-fill" style={{ height: `${pct}%` }} />
                  </div>
                  <span className="week-bar-label">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
