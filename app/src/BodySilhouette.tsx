import type { BodyType } from "./nutritionCalculator.js";

// Silhouettes humanoïdes simples, une par morphologie (pas par sexe — seuls
// les libellés texte s'adaptent au sexe, voir NutritionTargetsSummary).
const PATHS: Record<BodyType, string> = {
  // Fine et élancée : épaules étroites, silhouette longiligne.
  endurance:
    "M12 2a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM9.5 8c-.8 0-1.4.6-1.5 1.3L7 15h2l.4 7h1.2l.4-6h1l.4 6h1.2l.4-7h2l-1-5.7c-.1-.7-.7-1.3-1.5-1.3h-5z",
  // Cambrure en V modérée : épaules plus larges, taille marquée.
  athletic:
    "M12 2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM8.5 8c-1 0-1.8.7-2 1.7L5.5 14h2.3l.3 8h1.4l.5-7h1l.5 7h1.4l.3-8h2.3l-1-4.3c-.2-1-1-1.7-2-1.7h-5z",
  // Épaules larges et carrure massive.
  mass: "M12 1.7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM7.5 8c-1.2 0-2.2.9-2.4 2L4 14h2.6l.3 8.5h1.6l.5-7.5h1.4l.4-.1.4.1.5 7.5h1.6l.3-8.5H16l-1.1-4c-.2-1.1-1.2-2-2.4-2h-5z",
};

export default function BodySilhouette({ type }: { type: BodyType }) {
  return (
    <svg className="choice-card-icon" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={PATHS[type]} fill="currentColor" />
    </svg>
  );
}
