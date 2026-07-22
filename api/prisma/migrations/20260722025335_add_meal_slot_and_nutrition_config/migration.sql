-- AlterTable
ALTER TABLE "ConsumptionEntry" ADD COLUMN     "mealSlot" TEXT;

-- AlterTable
ALTER TABLE "FridgeItem" ADD COLUMN     "compatibleSlots" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "NutritionProfile" ADD COLUMN     "breakfastCaloriePercent" DOUBLE PRECISION,
ADD COLUMN     "dinnerCaloriePercent" DOUBLE PRECISION,
ADD COLUMN     "lunchCaloriePercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "compatibleSlots" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "NutritionModeConfig" (
    "id" TEXT NOT NULL,
    "goalMode" TEXT NOT NULL,
    "bodyType" TEXT,
    "calorieMultiplier" DOUBLE PRECISION NOT NULL,
    "proteinPerKg" DOUBLE PRECISION NOT NULL,
    "fatPercent" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionModeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionBenchmark" (
    "id" TEXT NOT NULL,
    "carbPercentMin" DOUBLE PRECISION NOT NULL DEFAULT 0.45,
    "carbPercentMax" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "fatPercentMin" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "fatPercentMax" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "proteinPercentMin" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "proteinPercentMax" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "issnProteinPerKgMin" DOUBLE PRECISION NOT NULL DEFAULT 1.6,
    "issnProteinPerKgMax" DOUBLE PRECISION NOT NULL DEFAULT 2.2,
    "defaultBreakfastPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.225,
    "defaultLunchPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.375,
    "defaultDinnerPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.275,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NutritionModeConfig_goalMode_bodyType_key" ON "NutritionModeConfig"("goalMode", "bodyType");

-- Backfill : compatibleSlots permissif (les 3 créneaux) sur les articles et
-- recettes existants, cohérent avec le comportement actuel où tout est
-- utilisable à tout moment. Les recettes sont ensuite retaguées plus
-- précisément par un script ponctuel (voir tâche de retag).
UPDATE "FridgeItem" SET "compatibleSlots" = ARRAY['petit-dejeuner', 'dejeuner', 'diner'];
UPDATE "Recipe" SET "compatibleSlots" = ARRAY['petit-dejeuner', 'dejeuner', 'diner'];

-- Backfill : NutritionModeConfig — reprise des valeurs actuellement en dur
-- dans api/src/nutritionCalculator.ts (GOAL_MODE_CONFIGS / BODY_TYPE_CONFIGS),
-- avec leur source documentée. Les valeurs Élite dépassant légèrement les
-- fourchettes ISSN/AMDR citées (mass: 2.4g/kg > 2.2g/kg ISSN ; lipides
-- 20-22% au ras du plancher AMDR 20%) sont conservées telles quelles —
-- décision produit explicite, pas une erreur.
INSERT INTO "NutritionModeConfig" ("id", "goalMode", "bodyType", "calorieMultiplier", "proteinPerKg", "fatPercent", "source", "updatedAt") VALUES
  ('58b0b250-aad6-427e-b44a-cae16f7baba9', 'chill', NULL, 1.0, 1.6, 0.30, 'Suivi souple proche du TDEE (multiplicateur neutre). Protéines et lipides dans les fourchettes ISSN (1.6-2.2g/kg) et AMDR (20-35% lipides).', now()),
  ('3b8bd54c-47f8-43fd-8e06-cb2356596c7b', 'ligne', NULL, 0.85, 2.2, 0.25, 'Déficit modéré de 15%. Protéines au maximum de la fourchette ISSN (2.2g/kg) pour préserver la masse maigre pendant la perte. Lipides dans AMDR (20-35%).', now()),
  ('86f3143c-8af4-4f4a-ae48-af5defe77700', 'elite', 'endurance', 0.83, 1.8, 0.22, 'Choix produit assumé (Mode Élite = déficit marqué + protéines élevées pour un physique sec). Protéines dans ISSN (1.6-2.2g/kg). Lipides à 22%, proche du plancher AMDR (20%) : assumé pour ce mode.', now()),
  ('5177ea4e-3d5b-42e5-9f59-968886594602', 'elite', 'athletic', 0.80, 2.2, 0.22, 'Choix produit assumé. Protéines au maximum ISSN (2.2g/kg). Lipides à 22%, proche du plancher AMDR (20%) : assumé pour ce mode.', now()),
  ('b5397d76-dcf4-4835-8dce-f177dddecf0b', 'elite', 'mass', 0.78, 2.4, 0.20, 'Choix produit assumé. Protéines à 2.4g/kg : dépasse légèrement la fourchette ISSN citée (max 2.2g/kg), assumé pour ce mode extrême. Lipides à 20% = plancher AMDR exact.', now());

-- Backfill : NutritionBenchmark, ligne singleton avec les valeurs par défaut.
INSERT INTO "NutritionBenchmark" ("id", "updatedAt") VALUES
  ('fe9a4dec-f2e0-4012-b08f-475709c15fd5', now());
