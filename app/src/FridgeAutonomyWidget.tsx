import { useEffect, useState } from "react";
import { getWeekPlan } from "./api.js";
import type { WeekPlan } from "./api.js";
import Card from "./Card.js";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// Nombre de jours consécutifs, à partir de demain (days[0]), pour lesquels
// les 3 créneaux sont couverts par le stock ACTUEL du frigo (stockCovered,
// déjà calculé par weekPlanner en décrémentant le stock repas après repas) —
// s'arrête au premier jour non entièrement couvert, jamais de "trous"
// comptés comme couverts plus loin dans la semaine.
function computeAutonomyDays(weekPlan: WeekPlan): number {
  let count = 0;
  for (const day of weekPlan.days) {
    if (day.slots.every((s) => s.stockCovered)) count += 1;
    else break;
  }
  return count;
}

export default function FridgeAutonomyWidget() {
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null | undefined>(undefined);

  useEffect(() => {
    getWeekPlan()
      .then((result) => setWeekPlan(result.weekPlan))
      .catch(() => setWeekPlan(null));
  }, []);

  if (!weekPlan || weekPlan.days.length === 0) return null;

  const autonomyDays = computeAutonomyDays(weekPlan);
  const tomorrow = weekPlan.days[0];
  const tomorrowHasExhausted = tomorrow.slots.some((s) => s.status === "exhausted");

  return (
    <Card className={`fridge-autonomy ${tomorrowHasExhausted ? "warning" : ""}`}>
      <h3>🧊 Autonomie frigo</h3>
      {autonomyDays > 0 ? (
        <>
          <p className="fridge-autonomy-headline">
            Repas couverts jusqu'au <strong>{formatDate(weekPlan.days[autonomyDays - 1].date)}</strong>
          </p>
          <p className="fridge-autonomy-detail">
            {autonomyDays} jour{autonomyDays > 1 ? "s" : ""} restant{autonomyDays > 1 ? "s" : ""} avec ton stock actuel
          </p>
        </>
      ) : (
        <p className="fridge-autonomy-headline">Aucun repas de demain n'est encore couvert par ton stock actuel.</p>
      )}
      {tomorrowHasExhausted && (
        <p className="fridge-autonomy-warning">⚠️ Au moins un repas de demain n'a aucune recette compatible — pense à ajuster ton planning.</p>
      )}
    </Card>
  );
}
