import { Flame, Beef, Droplet, Wheat } from "lucide-react";
import type { NutritionTargets } from "./nutritionCalculator.js";
import type { ConsumptionEntry } from "./api.js";
import MacroRing from "./MacroRing.js";

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

export default function DailyProgress({
  targets,
  consumed,
  compact,
}: {
  targets: NutritionTargets;
  consumed: ConsumedTotals;
  compact?: boolean;
}) {
  const size = compact ? 60 : 76;
  const iconSize = compact ? 16 : 18;
  return (
    <div className={`daily-progress ${compact ? "compact" : ""}`}>
      {!compact && <h3>Progression du jour</h3>}
      <div className="macro-ring-row">
        <MacroRing
          value={consumed.calories}
          target={targets.targetCalories}
          size={size}
          color="var(--ring-calories)"
          icon={<Flame size={iconSize} />}
          label="Calories"
          valueLabel={`${Math.round(consumed.calories)}`}
        />
        <MacroRing
          value={consumed.protein}
          target={targets.targetProteinG}
          size={size}
          color="var(--ring-protein)"
          icon={<Beef size={iconSize} />}
          label="Protéines"
          valueLabel={`${Math.round(consumed.protein)}g`}
        />
        <MacroRing
          value={consumed.fat}
          target={targets.targetFatG}
          size={size}
          color="var(--ring-fat)"
          icon={<Droplet size={iconSize} />}
          label="Lipides"
          valueLabel={`${Math.round(consumed.fat)}g`}
        />
        <MacroRing
          value={consumed.carbs}
          target={targets.targetCarbsG}
          size={size}
          color="var(--ring-carbs)"
          icon={<Wheat size={iconSize} />}
          label="Glucides"
          valueLabel={`${Math.round(consumed.carbs)}g`}
        />
      </div>
    </div>
  );
}
