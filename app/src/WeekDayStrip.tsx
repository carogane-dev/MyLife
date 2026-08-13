import { useEffect, useState } from "react";
import { getConsumptionEntries } from "./api.js";
import type { NutritionProfile } from "./api.js";
import { calculateNutritionTargets } from "./nutritionCalculator.js";
import { useNutritionConfig } from "./useNutritionConfig.js";

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"]; // getDay() : 0 = dimanche

interface DayTotal {
  date: Date;
  caloriesPct: number;
  isToday: boolean;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Bande compacte des 7 derniers jours (aujourd'hui inclus) avec un mini
// anneau par jour montrant le % de l'objectif calorique atteint — inspirée
// des apps de suivi nutritionnel qui condensent la semaine en un coup
// d'œil. Fenêtre glissante (J-6 à J) plutôt qu'une semaine calendaire
// lundi-dimanche : reste toujours pertinente y compris en tout début de
// semaine, sans jours futurs vides à afficher.
export default function WeekDayStrip({ profile }: { profile: NutritionProfile }) {
  const [days, setDays] = useState<DayTotal[] | null>(null);
  const { modeConfigs } = useNutritionConfig();
  const targets = calculateNutritionTargets(profile, modeConfigs);

  useEffect(() => {
    if (!targets) return;
    const today = startOfDay(new Date());
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);

    getConsumptionEntries(from.toISOString(), to.toISOString())
      .then((entries) => {
        const byDay = new Map<string, number>();
        for (const e of entries) {
          const key = startOfDay(new Date(e.consumedAt)).toDateString();
          byDay.set(key, (byDay.get(key) ?? 0) + e.calories);
        }
        const result: DayTotal[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const calories = byDay.get(d.toDateString()) ?? 0;
          result.push({
            date: d,
            caloriesPct: targets.targetCalories > 0 ? Math.min(1, calories / targets.targetCalories) : 0,
            isToday: i === 0,
          });
        }
        setDays(result);
      })
      .catch(() => setDays(null));
  }, [targets?.targetCalories]);

  if (!days) return null;

  return (
    <div className="week-day-strip">
      {days.map((d) => {
        const size = 34;
        const stroke = 3;
        const radius = (size - stroke) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - d.caloriesPct);
        return (
          <div className={`week-day-strip-item ${d.isToday ? "today" : ""}`} key={d.date.toDateString()}>
            <span className="week-day-strip-letter">{DAY_LETTERS[d.date.getDay()]}</span>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--ring-calories)"
                strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
              <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="11" fill="var(--color-text-primary)">
                {d.date.getDate()}
              </text>
            </svg>
          </div>
        );
      })}
    </div>
  );
}
