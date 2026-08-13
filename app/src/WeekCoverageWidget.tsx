import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCw } from "lucide-react";
import { getWeekPlan, rejectWeekPlanEntry } from "./api.js";
import type { MealSlot, WeekPlan, WeekPlanSlotAssignment } from "./api.js";
import Card from "./Card.js";

const SLOTS: MealSlot[] = ["petit-dejeuner", "dejeuner", "diner"];
const SLOT_ICONS: Record<MealSlot, string> = {
  "petit-dejeuner": "🌅",
  dejeuner: "☀️",
  diner: "🌙",
};
const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"]; // getDay() : 0 = dimanche

function cellClass(slot: WeekPlanSlotAssignment | undefined): string {
  if (!slot || !slot.match) return "week-coverage-cell empty";
  if (slot.status === "eaten") return "week-coverage-cell eaten";
  if (slot.status === "accepted") return "week-coverage-cell accepted";
  if (slot.status === "exhausted") return "week-coverage-cell exhausted";
  return slot.stockCovered ? "week-coverage-cell covered" : "week-coverage-cell uncovered";
}

// Grille compacte J+1 à J+7 × 3 créneaux, un coup d'œil sur ce que le
// planning a réussi à couvrir avec le stock actuel du frigo (stockCovered,
// calculé par weekPlanner) — les créneaux non couverts sont grisés, ceux
// encore "proposed" ont un reroll direct (même mécanisme que le refus dans
// WeekPlanPage, sans repasser par la revue carte par carte).
export default function WeekCoverageWidget() {
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null | undefined>(undefined);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getWeekPlan()
      .then((result) => setWeekPlan(result.weekPlan))
      .catch(() => setWeekPlan(null));
  }, []);

  if (!weekPlan || weekPlan.days.length === 0) return null;

  async function handleReroll(slot: WeekPlanSlotAssignment) {
    setBusyEntryId(slot.entryId);
    try {
      const result = await rejectWeekPlanEntry(slot.entryId);
      if (result.weekPlan) setWeekPlan(result.weekPlan);
    } catch {
      // Reroll silencieux : la grille reste inchangée, l'utilisateur peut réessayer.
    } finally {
      setBusyEntryId(null);
    }
  }

  return (
    <Card className="week-coverage">
      <div className="week-coverage-header">
        <h3>📅 Semaine à venir</h3>
        <button className="week-coverage-link" onClick={() => navigate("/week-plan")}>
          Voir tout
        </button>
      </div>
      <div className="week-coverage-grid">
        <div className="week-coverage-row week-coverage-row-header">
          <span className="week-coverage-row-label" />
          {weekPlan.days.map((day) => {
            const d = new Date(`${day.date}T00:00:00`);
            return (
              <span className="week-coverage-day-label" key={day.date}>
                {DAY_LETTERS[d.getDay()]}
                <br />
                {d.getDate()}
              </span>
            );
          })}
        </div>
        {SLOTS.map((slot) => (
          <div className="week-coverage-row" key={slot}>
            <span className="week-coverage-row-label" title={slot}>
              {SLOT_ICONS[slot]}
            </span>
            {weekPlan.days.map((day) => {
              const assignment = day.slots.find((s) => s.slot === slot);
              const canReroll = assignment && assignment.status === "proposed" && !!assignment.match;
              const busy = !!assignment && busyEntryId === assignment.entryId;
              return (
                <button
                  key={day.date}
                  className={cellClass(assignment)}
                  title={assignment?.match?.recipeName ?? "Rien de prévu"}
                  disabled={!canReroll || busy}
                  onClick={canReroll ? () => handleReroll(assignment!) : undefined}
                >
                  {busy ? "…" : canReroll ? <RotateCw size={12} /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="week-coverage-legend">
        <span className="week-coverage-legend-dot covered" /> couvert par le frigo
        <span className="week-coverage-legend-dot uncovered" /> à compléter
      </p>
    </Card>
  );
}
