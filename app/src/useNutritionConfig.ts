import { useEffect, useState } from "react";
import { getNutritionConfig } from "./api.js";
import type { NutritionModeConfigEntry } from "./api.js";

// Filet de sécurité local si l'appel réseau échoue : mêmes valeurs que
// celles insérées par la migration (voir api/prisma/migrations/…), pour ne
// jamais bloquer l'affichage des objectifs sur une panne réseau ponctuelle.
// La base reste la source de vérité — ce repli n'est qu'un secours.
const FALLBACK_SOURCE = "Repli local (panne réseau) — voir la base pour la source scientifique à jour.";
const FALLBACK_MODE_CONFIGS: NutritionModeConfigEntry[] = [
  { goalMode: "chill", bodyType: null, calorieMultiplier: 1.0, proteinPerKg: 1.6, fatPercent: 0.3, source: FALLBACK_SOURCE },
  { goalMode: "ligne", bodyType: null, calorieMultiplier: 0.85, proteinPerKg: 2.2, fatPercent: 0.25, source: FALLBACK_SOURCE },
  { goalMode: "elite", bodyType: "endurance", calorieMultiplier: 0.83, proteinPerKg: 1.8, fatPercent: 0.22, source: FALLBACK_SOURCE },
  { goalMode: "elite", bodyType: "athletic", calorieMultiplier: 0.8, proteinPerKg: 2.2, fatPercent: 0.22, source: FALLBACK_SOURCE },
  { goalMode: "elite", bodyType: "mass", calorieMultiplier: 0.78, proteinPerKg: 2.4, fatPercent: 0.2, source: FALLBACK_SOURCE },
];

export function useNutritionConfig() {
  const [modeConfigs, setModeConfigs] = useState<NutritionModeConfigEntry[]>(FALLBACK_MODE_CONFIGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNutritionConfig()
      .then(({ modeConfigs }) => setModeConfigs(modeConfigs))
      .catch(() => setModeConfigs(FALLBACK_MODE_CONFIGS))
      .finally(() => setLoading(false));
  }, []);

  return { modeConfigs, loading };
}
