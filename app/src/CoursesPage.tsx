import { useEffect, useState } from "react";
import { getWeekPlan } from "./api.js";
import type { MealSlot, WeekPlan } from "./api.js";
import { useNavigate } from "react-router-dom";
import { useToast } from "./ToastProvider.js";
import Card from "./Card.js";
import Skeleton from "./Skeleton.js";

const SLOT_LABELS: Record<MealSlot, string> = {
  "petit-dejeuner": "🌅 Petit-déjeuner",
  dejeuner: "☀️ Déjeuner",
  diner: "🌙 Dîner",
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;
}

// Créneaux sans aucune recette compatible restante (voir weekPlanner —
// aucun plafond dur/variété ne laisse plus de candidat) : le solveur ne
// peut rien proposer de mieux, l'utilisateur doit composer lui-même via le
// composeur manuel.
function findEntriesToBuild(weekPlan: WeekPlan): { date: string; slot: MealSlot }[] {
  const list: { date: string; slot: MealSlot }[] = [];
  for (const day of weekPlan.days) {
    for (const s of day.slots) {
      if (s.status === "exhausted" && !s.match) list.push({ date: day.date, slot: s.slot });
    }
  }
  return list;
}

export default function CoursesPage({ onBack }: { onBack: () => void }) {
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    if (error) showToast(error);
  }, [error, showToast]);

  useEffect(() => {
    getWeekPlan()
      .then((result) => {
        setWeekPlan(result.weekPlan);
        setReason(result.reason ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  const toBuild = weekPlan ? findEntriesToBuild(weekPlan) : [];

  return (
    <div className="courses-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <div className="fridge-toolbar">
        <h2>🛒 Courses</h2>
        <button className="fridge-add-button" onClick={() => navigate("/scan?mode=shopping")}>
          📷 Scanner mes courses
        </button>
      </div>
      <p className="wizard-hint">
        Ce qu'il te manque pour couvrir les 21 prochains repas, et les créneaux que le planning n'a pas réussi à
        composer automatiquement.
      </p>

      {loading && (
        <div className="skeleton-stack">
          <Skeleton height="24px" width="40%" />
          <Skeleton height="120px" />
        </div>
      )}

      {!loading && !weekPlan && reason && <p className="fridge-empty">{reason}</p>}

      {!loading && weekPlan && (
        <>
          {toBuild.length > 0 && (
            <Card className="courses-to-build">
              <h3>🧑‍🍳 Repas à construire</h3>
              <p className="wizard-hint">
                Aucune recette compatible n'a pu être trouvée pour ces créneaux — compose-les toi-même.
              </p>
              <ul className="meal-item-list">
                {toBuild.map(({ date, slot }) => (
                  <li className="meal-item-row" key={`${date}|${slot}`}>
                    <span className="meal-item-name">
                      {formatDate(date)} · {SLOT_LABELS[slot]}
                    </span>
                    <button className="week-plan-mini-regen" onClick={() => navigate("/meal-builder")}>
                      Composer un repas
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {weekPlan.shoppingList.length > 0 ? (
            <Card className="week-plan-shopping-list">
              <h3>🛒 Liste de courses de la semaine</h3>
              <p className="wizard-hint">
                Ce qu'il manque au total pour couvrir les 21 repas — diminue au fur et à mesure que tu ajoutes ces
                aliments à ton frigo.
              </p>
              <ul className="meal-item-list">
                {weekPlan.shoppingList.map((item) => (
                  <li className="meal-item-row" key={item.name}>
                    <span className="meal-item-name">{item.name}</span>
                    <span className="meal-item-macros">{formatGrams(item.totalShortfallGrams)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            toBuild.length === 0 && <p className="fridge-empty">Ton stock couvre déjà tous les repas planifiés. 🎉</p>
          )}
        </>
      )}
    </div>
  );
}
