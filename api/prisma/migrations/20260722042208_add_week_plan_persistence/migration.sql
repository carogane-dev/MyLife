-- CreateTable
CREATE TABLE "WeekPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekPlanEntry" (
    "id" TEXT NOT NULL,
    "weekPlanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "slot" TEXT NOT NULL,
    "recipeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "weekPlanEntryId" TEXT,
    "slot" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeekPlan_userId_startDate_key" ON "WeekPlan"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeekPlanEntry_weekPlanId_date_slot_key" ON "WeekPlanEntry"("weekPlanId", "date", "slot");

-- CreateIndex
CREATE INDEX "RecipeDecision_recipeId_idx" ON "RecipeDecision"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeDecision_weekPlanEntryId_idx" ON "RecipeDecision"("weekPlanEntryId");

-- AddForeignKey
ALTER TABLE "WeekPlan" ADD CONSTRAINT "WeekPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekPlanEntry" ADD CONSTRAINT "WeekPlanEntry_weekPlanId_fkey" FOREIGN KEY ("weekPlanId") REFERENCES "WeekPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekPlanEntry" ADD CONSTRAINT "WeekPlanEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeDecision" ADD CONSTRAINT "RecipeDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeDecision" ADD CONSTRAINT "RecipeDecision_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeDecision" ADD CONSTRAINT "RecipeDecision_weekPlanEntryId_fkey" FOREIGN KEY ("weekPlanEntryId") REFERENCES "WeekPlanEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
