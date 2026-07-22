import { useEffect, useState } from "react";
import { getConsumptionEntries } from "./api.js";
import type { NutritionProfile } from "./api.js";
import { calculateNutritionTargets } from "./nutritionCalculator.js";
import { useNutritionConfig } from "./useNutritionConfig.js";
import DailyProgress, { sumConsumption } from "./DailyProgress.js";
import type { ConsumedTotals } from "./DailyProgress.js";

function todayRange(): { from: string; to: string } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function HomeProgress({ profile }: { profile: NutritionProfile }) {
  const [consumed, setConsumed] = useState<ConsumedTotals | null>(null);
  const { modeConfigs } = useNutritionConfig();

  useEffect(() => {
    const { from, to } = todayRange();
    getConsumptionEntries(from, to)
      .then((entries) => setConsumed(sumConsumption(entries)))
      .catch(() => setConsumed({ calories: 0, protein: 0, fat: 0, carbs: 0 }));
  }, []);

  const targets = calculateNutritionTargets(profile, modeConfigs);

  if (!targets || !consumed) return null;

  return (
    <div className="home-progress">
      <DailyProgress targets={targets} consumed={consumed} compact />
    </div>
  );
}
