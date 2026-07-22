import { useEffect, useState } from "react";
import { getGamificationSummary } from "./api.js";
import type { GamificationSummary as GamificationSummaryData } from "./api.js";

export default function GamificationSummary() {
  const [summary, setSummary] = useState<GamificationSummaryData | null>(null);

  useEffect(() => {
    getGamificationSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  if (!summary) return null;

  return (
    <div className="gamification-summary">
      <div className="gamification-stats-row">
        {summary.streak.currentDays === null ? (
          <span className="gamification-streak-free">🧊 Mode Libre — pas de série de jours réussis à suivre</span>
        ) : (
          <span className="gamification-streak">
            🔥 <strong>{summary.streak.currentDays}</strong> jour{summary.streak.currentDays > 1 ? "s" : ""} de suite
            {summary.streak.bestDays! > summary.streak.currentDays && (
              <span className="gamification-best-streak"> (record : {summary.streak.bestDays})</span>
            )}
          </span>
        )}
        <span className="gamification-points">
          ⭐ <strong>{summary.totalPoints}</strong> points · Niveau {summary.level}
        </span>
      </div>

      <ul className="gamification-badges">
        {summary.badges.map((badge) => (
          <li key={badge.id} className={`recipe-badge gamification-badge ${badge.earned ? "earned" : "locked"}`} title={badge.label}>
            <span className="gamification-badge-icon">{badge.earned ? badge.icon : "🔒"}</span> {badge.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
