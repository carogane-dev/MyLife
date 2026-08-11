import { useEffect, useState } from "react";
import { Flame, Star, Snowflake } from "lucide-react";
import { getGamificationSummary } from "./api.js";
import type { GamificationSummary as GamificationSummaryData } from "./api.js";
import Card from "./Card.js";

// Miroir de POINTS_PER_LEVEL dans api/src/gamification.ts — uniquement pour
// dériver la progression dans le niveau courant (anneau/barre), la valeur
// canonique du niveau reste toujours calculée côté serveur.
const POINTS_PER_LEVEL = 200;

export default function GamificationSummary() {
  const [summary, setSummary] = useState<GamificationSummaryData | null>(null);

  useEffect(() => {
    getGamificationSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  if (!summary) return null;

  const levelProgress = (summary.totalPoints % POINTS_PER_LEVEL) / POINTS_PER_LEVEL;

  return (
    <Card className="gamification-summary">
      <div className="gamification-row">
        <div className="gamification-streak">
          {summary.streak.currentDays === null ? (
            <>
              <Snowflake size={16} strokeWidth={1.75} />
              <span>Mode Libre</span>
            </>
          ) : (
            <>
              <Flame size={16} strokeWidth={1.75} />
              <span>
                <strong>{summary.streak.currentDays}</strong> jour{summary.streak.currentDays > 1 ? "s" : ""} de suite
                {summary.streak.bestDays! > summary.streak.currentDays && (
                  <span className="gamification-best-streak"> · record {summary.streak.bestDays}</span>
                )}
              </span>
            </>
          )}
        </div>

        <div className="gamification-level">
          <span className="gamification-level-label">Niveau {summary.level}</span>
          <div className="gamification-level-track">
            <div className="gamification-level-fill" style={{ width: `${Math.round(levelProgress * 100)}%` }} />
          </div>
          <span className="gamification-level-points">
            <Star size={13} strokeWidth={1.75} />
            {summary.totalPoints}
          </span>
        </div>
      </div>

      <ul className="gamification-badges">
        {summary.badges.map((badge) => (
          <li key={badge.id} className={`gamification-badge ${badge.earned ? "earned" : "locked"}`} title={badge.label}>
            <span className="gamification-badge-icon">{badge.earned ? badge.icon : "•"}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
