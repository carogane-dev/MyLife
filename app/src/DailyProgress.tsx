import type { NutritionTargets } from "./nutritionCalculator.js";
import type { ConsumptionEntry } from "./api.js";

export interface ConsumedTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export function sumConsumption(entries: ConsumptionEntry[]): ConsumedTotals {
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

function ProgressBar({
  icon,
  label,
  consumed,
  target,
  unit,
}: {
  icon: string;
  label: string;
  consumed: number;
  target: number;
  unit: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const over = consumed > target;
  return (
    <div className="progress-bar-row">
      <div className="progress-bar-label">
        <span>
          {icon} {label}
        </span>
        <span>
          {Math.round(consumed)}
          {unit} / {Math.round(target)}
          {unit}
        </span>
      </div>
      <div className="progress-bar-track">
        <div className={`progress-bar-fill ${over ? "over" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DailyProgress({
  targets,
  consumed,
  compact,
}: {
  targets: NutritionTargets;
  consumed: ConsumedTotals;
  compact?: boolean;
}) {
  return (
    <div className={`daily-progress ${compact ? "compact" : ""}`}>
      {!compact && <h3>🎮 Progression du jour</h3>}
      <ProgressBar icon="🔥" label="Calories" consumed={consumed.calories} target={targets.targetCalories} unit=" kcal" />
      <ProgressBar icon="🥩" label="Protéines" consumed={consumed.protein} target={targets.targetProteinG} unit="g" />
      <ProgressBar icon="🥑" label="Lipides" consumed={consumed.fat} target={targets.targetFatG} unit="g" />
      <ProgressBar icon="🌾" label="Glucides" consumed={consumed.carbs} target={targets.targetCarbsG} unit="g" />
    </div>
  );
}
