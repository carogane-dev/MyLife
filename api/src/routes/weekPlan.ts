import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { computeDailyBudget } from "../dailyBudget.js";
import { generateWeekPlan } from "../weekPlanner.js";
import type { WeekPlan } from "../weekPlanner.js";
import { computeAffinityScores } from "../recipeMatcher.js";

export const weekPlanRouter = Router();

const NO_PROFILE_REASON = "Profil non configuré ou pas d'objectif calorique dans ce mode.";
const NO_RECIPES_REASON = "Aucune recette disponible pour l'instant.";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Le planning porte toujours sur J+1 à J+7 au moment de sa création : ne
// dépend pas de l'heure de l'appel (contrairement à /api/meal-suggestion).
function tomorrowMidnight(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function entryDateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Stocke chaque date de créneau comme minuit UTC de la chaîne ISO produite
// par weekPlanner.toIsoDate — round-trip exact via entryDateToIso, sans
// dépendre du fuseau horaire du serveur (contrairement à un simple `new
// Date(isoString)` interprété en heure locale).
function isoToEntryDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function loadContext(userId: string) {
  const budgetInfo = await computeDailyBudget(userId);
  if (!budgetInfo) return null;
  const { targets, slotContext } = budgetInfo;
  const [recipes, fridgeItems, decisions] = await Promise.all([
    prisma.recipe.findMany({ include: { ingredients: true } }),
    prisma.fridgeItem.findMany({ where: { userId, quantity: { gt: 0 } } }),
    prisma.recipeDecision.findMany({ where: { userId }, select: { recipeId: true, accepted: true } }),
  ]);
  const dailyTargets = {
    calories: targets.targetCalories,
    protein: targets.targetProteinG,
    fat: targets.targetFatG,
    carbs: targets.targetCarbsG,
  };
  const affinityScores = computeAffinityScores(decisions);
  return { targets, slotContext, recipes, fridgeItems, dailyTargets, affinityScores };
}

type WeekPlanContext = Exclude<Awaited<ReturnType<typeof loadContext>>, null>;

interface PersistedEntry {
  id: string;
  date: Date;
  slot: string;
  recipeId: string | null;
  status: string;
  attempts: number;
}

// Seuls les créneaux "décidés" (acceptés, mangés, ou épuisés après 5 refus)
// gardent leur recette figée d'un hydrate() à l'autre. Un créneau encore
// "proposed" ET JAMAIS REFUSÉ (attempts === 1, sa toute première
// proposition) reste libre d'être recalculé à chaque appel : sinon,
// accepter un petit-déjeuner plus léger que prévu ne fait jamais gonfler le
// budget du déjeuner/dîner encore proposés, qui restent figés sur la
// recette choisie à la création initiale du planning — la cause du bug où
// une journée finit très en-dessous de l'objectif malgré l'auto-correction
// déjà présente dans generateWeekPlan (consumedSoFar cumulatif).
//
// Un créneau déjà refusé au moins une fois (attempts > 1) DOIT rester
// épinglé lui aussi : sa recette actuelle a été choisie par
// rejectAndRegenerateEntry en excluant précisément les recettes déjà
// refusées POUR CE CRÉNEAU (RecipeDecision) — un exclude par créneau que
// generateWeekPlan ne connaît pas (son excludeRecipeIds est global). Sans
// cet épinglage, l'appel à hydrate() juste après un refus resélectionnerait
// ce même créneau sans tenir compte de l'historique de refus et pourrait
// immédiatement re-proposer la recette qui vient d'être refusée.
const DECIDED_STATUSES = new Set(["accepted", "eaten", "exhausted"]);

function buildPinnedAssignments(entries: PersistedEntry[], excludeEntryId?: string): Map<string, string> {
  const pinned = new Map<string, string>();
  for (const e of entries) {
    if (e.id === excludeEntryId) continue;
    if (e.recipeId && (DECIDED_STATUSES.has(e.status) || e.attempts > 1)) {
      pinned.set(`${entryDateToIso(e.date)}|${e.slot}`, e.recipeId);
    }
  }
  return pinned;
}

async function createFreshWeekPlan(userId: string, ctx: WeekPlanContext) {
  const startDate = tomorrowMidnight();
  const plan = generateWeekPlan(
    ctx.recipes,
    ctx.fridgeItems,
    ctx.dailyTargets,
    ctx.targets,
    ctx.slotContext,
    startDate,
    new Set(),
    new Map(),
    ctx.affinityScores
  );
  return prisma.weekPlan.create({
    data: {
      userId,
      startDate,
      entries: {
        create: plan.days.flatMap((day) =>
          day.slots.map((s) => ({
            date: isoToEntryDate(day.date),
            slot: s.slot,
            recipeId: s.match ? s.match.recipeId : null,
            status: "proposed",
            attempts: 1,
          }))
        ),
      },
    },
    include: { entries: true },
  });
}

// Réutilise generateWeekPlan à 100% épinglé sur les décisions déjà
// persistées : aucune nouvelle logique de sélection, seulement un
// recalcul des quantités/couverture stock/liste de courses à partir de
// l'état courant du frigo, plus la fusion des métadonnées de décision
// (entryId/status/attempts) sur chaque créneau.
async function hydrate(
  planRecord: { startDate: Date; entries: PersistedEntry[] },
  ctx: WeekPlanContext
): Promise<WeekPlan & { days: Array<WeekPlan["days"][number] & { slots: Array<WeekPlan["days"][number]["slots"][number] & { entryId: string; status: string; attempts: number }> }> }> {
  // Seuls les créneaux décidés sont épinglés — voir DECIDED_STATUSES : un
  // créneau encore "proposed" est recalculé à chaque hydrate() pour
  // refléter le budget réellement restant ce jour-là (auto-correction déjà
  // gérée par generateWeekPlan via consumedSoFar).
  const pinnedAssignments = buildPinnedAssignments(planRecord.entries);

  const weekPlan = generateWeekPlan(
    ctx.recipes,
    ctx.fridgeItems,
    ctx.dailyTargets,
    ctx.targets,
    ctx.slotContext,
    planRecord.startDate,
    new Set(),
    pinnedAssignments,
    ctx.affinityScores
  );

  const entryByKey = new Map(planRecord.entries.map((e) => [`${entryDateToIso(e.date)}|${e.slot}`, e]));

  // Un créneau "proposed" recalculé ci-dessus peut désormais pointer vers
  // une recette différente de celle stockée (budget mis à jour) : la
  // persister est indispensable pour qu'accepter/refuser agissent bien sur
  // la recette actuellement affichée, pas sur celle de la création initiale.
  const updates: Promise<unknown>[] = [];
  const days = weekPlan.days.map((day) => ({
    date: day.date,
    slots: day.slots.map((s) => {
      const entry = entryByKey.get(`${day.date}|${s.slot}`);
      if (entry && entry.status === "proposed") {
        const newRecipeId = s.match?.recipeId ?? null;
        if (newRecipeId !== entry.recipeId) {
          updates.push(prisma.weekPlanEntry.update({ where: { id: entry.id }, data: { recipeId: newRecipeId } }));
          entry.recipeId = newRecipeId;
        }
      }
      return {
        ...s,
        entryId: entry?.id ?? "",
        status: entry?.status ?? "proposed",
        attempts: entry?.attempts ?? 1,
      };
    }),
  }));

  if (updates.length > 0) await Promise.all(updates);

  return { ...weekPlan, days };
}

async function respondHydrated(res: Response, planRecord: { id: string; startDate: Date; entries: PersistedEntry[] }, ctx: WeekPlanContext) {
  res.status(200).json({ weekPlan: await hydrate(planRecord, ctx) });
}

// Journalise le refus de la recette courante d'un créneau, puis :
// - si la limite de 5 essais est atteinte, passe le créneau à "exhausted"
//   (garde la dernière recette proposée, cohérent avec "ajuster
//   manuellement" plutôt qu'un créneau vide) ;
// - sinon régénère UNIQUEMENT ce créneau via generateWeekPlan, en épinglant
//   tous les autres créneaux du planning à leur recette actuelle et en
//   excluant la recette refusée + toutes celles déjà refusées avant elle
//   pour ce même créneau.
async function rejectAndRegenerateEntry(entry: PersistedEntry, weekPlanId: string, weekPlanStartDate: Date, ctx: WeekPlanContext, userId: string) {
  if (!entry.recipeId) return;

  await prisma.recipeDecision.create({
    data: { userId, recipeId: entry.recipeId, weekPlanEntryId: entry.id, slot: entry.slot, accepted: false },
  });

  if (entry.attempts >= 5) {
    await prisma.weekPlanEntry.update({ where: { id: entry.id }, data: { status: "exhausted" } });
    return;
  }

  const allEntries = await prisma.weekPlan.findUniqueOrThrow({ where: { id: weekPlanId }, include: { entries: true } });
  const pinnedAssignments = buildPinnedAssignments(allEntries.entries, entry.id);

  const rejectedDecisions = await prisma.recipeDecision.findMany({
    where: { weekPlanEntryId: entry.id, accepted: false },
    select: { recipeId: true },
  });
  const excludeIds = new Set(rejectedDecisions.map((d) => d.recipeId));

  const regenerated = generateWeekPlan(
    ctx.recipes,
    ctx.fridgeItems,
    ctx.dailyTargets,
    ctx.targets,
    ctx.slotContext,
    weekPlanStartDate,
    excludeIds,
    pinnedAssignments,
    ctx.affinityScores
  );
  const dateStr = entryDateToIso(entry.date);
  const newRecipeId = regenerated.days.find((d) => d.date === dateStr)?.slots.find((s) => s.slot === entry.slot)?.match?.recipeId ?? null;

  await prisma.weekPlanEntry.update({
    where: { id: entry.id },
    data: { recipeId: newRecipeId, attempts: entry.attempts + 1, status: newRecipeId ? "proposed" : "exhausted" },
  });
}

// Trouve le planning en cours de l'utilisateur, ou en crée un frais si
// aucun n'existe ou si celui trouvé porte sur une semaine déjà entièrement
// passée (startDate + 7 jours <= maintenant).
weekPlanRouter.get("/", requireAuth, async (req, res) => {
  const ctx = await loadContext(req.user!.id);
  if (!ctx) {
    res.status(200).json({ weekPlan: null, reason: NO_PROFILE_REASON });
    return;
  }
  if (ctx.recipes.length === 0) {
    res.status(200).json({ weekPlan: null, reason: NO_RECIPES_REASON });
    return;
  }

  let planRecord = await prisma.weekPlan.findFirst({
    where: { userId: req.user!.id },
    orderBy: { startDate: "desc" },
    include: { entries: true },
  });
  const stillValid = planRecord && planRecord.startDate.getTime() + WEEK_MS > Date.now();
  if (!planRecord || !stillValid) {
    planRecord = await createFreshWeekPlan(req.user!.id, ctx);
  }

  await respondHydrated(res, planRecord, ctx);
});

weekPlanRouter.post("/entries/:entryId/accept", requireAuth, async (req, res) => {
  const entry = await prisma.weekPlanEntry.findUnique({ where: { id: req.params.entryId }, include: { weekPlan: true } });
  if (!entry || entry.weekPlan.userId !== req.user!.id) {
    res.status(404).json({ error: "Repas introuvable." });
    return;
  }
  if (!entry.recipeId) {
    res.status(400).json({ error: "Aucune recette à accepter pour ce repas." });
    return;
  }
  if (entry.status !== "proposed") {
    res.status(400).json({ error: "Ce repas n'est plus en attente de décision." });
    return;
  }

  const ctx = await loadContext(req.user!.id);
  if (!ctx) {
    res.status(200).json({ weekPlan: null, reason: NO_PROFILE_REASON });
    return;
  }

  await prisma.$transaction([
    prisma.recipeDecision.create({
      data: { userId: req.user!.id, recipeId: entry.recipeId, weekPlanEntryId: entry.id, slot: entry.slot, accepted: true },
    }),
    prisma.weekPlanEntry.update({ where: { id: entry.id }, data: { status: "accepted" } }),
  ]);

  const planRecord = await prisma.weekPlan.findUniqueOrThrow({ where: { id: entry.weekPlanId }, include: { entries: true } });
  await respondHydrated(res, planRecord, ctx);
});

weekPlanRouter.post("/entries/:entryId/reject", requireAuth, async (req, res) => {
  const entry = await prisma.weekPlanEntry.findUnique({ where: { id: req.params.entryId }, include: { weekPlan: true } });
  if (!entry || entry.weekPlan.userId !== req.user!.id) {
    res.status(404).json({ error: "Repas introuvable." });
    return;
  }
  if (!entry.recipeId) {
    res.status(400).json({ error: "Aucune recette à refuser pour ce repas." });
    return;
  }
  if (entry.status !== "proposed") {
    res.status(400).json({ error: "Ce repas n'est plus en attente de décision." });
    return;
  }

  const ctx = await loadContext(req.user!.id);
  if (!ctx) {
    res.status(200).json({ weekPlan: null, reason: NO_PROFILE_REASON });
    return;
  }

  await rejectAndRegenerateEntry(entry, entry.weekPlanId, entry.weekPlan.startDate, ctx, req.user!.id);

  const planRecord = await prisma.weekPlan.findUniqueOrThrow({ where: { id: entry.weekPlanId }, include: { entries: true } });
  await respondHydrated(res, planRecord, ctx);
});

// Le front appelle d'abord /api/consumption (logManualConsumption, route
// existante) pour journaliser la consommation elle-même, puis cette route
// juste pour marquer le créneau du planning comme "mangé" — toute la
// logique de calcul de consommation reste dans consumption.ts.
weekPlanRouter.post("/entries/:entryId/mark-eaten", requireAuth, async (req, res) => {
  const entry = await prisma.weekPlanEntry.findUnique({ where: { id: req.params.entryId }, include: { weekPlan: true } });
  if (!entry || entry.weekPlan.userId !== req.user!.id) {
    res.status(404).json({ error: "Repas introuvable." });
    return;
  }
  if (entry.status === "eaten" || (entry.status !== "accepted" && entry.status !== "exhausted")) {
    res.status(400).json({ error: "Ce repas ne peut pas être marqué comme mangé dans son état actuel." });
    return;
  }

  const ctx = await loadContext(req.user!.id);
  if (!ctx) {
    res.status(200).json({ weekPlan: null, reason: NO_PROFILE_REASON });
    return;
  }

  await prisma.weekPlanEntry.update({ where: { id: entry.id }, data: { status: "eaten" } });

  const planRecord = await prisma.weekPlan.findUniqueOrThrow({ where: { id: entry.weekPlanId }, include: { entries: true } });
  await respondHydrated(res, planRecord, ctx);
});

// Applique la même logique que /reject à chaque créneau encore "proposed"
// de ce jour (ignore les créneaux déjà acceptés/mangés/épuisés) —
// remplace l'ancien "régénérer ce jour" sans limite d'essais.
weekPlanRouter.post("/days/:date/regenerate-remaining", requireAuth, async (req, res) => {
  const dateParam = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    res.status(400).json({ error: "Date invalide." });
    return;
  }

  const planRecord = await prisma.weekPlan.findFirst({
    where: { userId: req.user!.id },
    orderBy: { startDate: "desc" },
    include: { entries: true },
  });
  if (!planRecord) {
    res.status(404).json({ error: "Aucun planning en cours." });
    return;
  }

  const ctx = await loadContext(req.user!.id);
  if (!ctx) {
    res.status(200).json({ weekPlan: null, reason: NO_PROFILE_REASON });
    return;
  }

  const dayEntries = planRecord.entries.filter((e) => entryDateToIso(e.date) === dateParam && e.status === "proposed");
  for (const entry of dayEntries) {
    await rejectAndRegenerateEntry(entry, planRecord.id, planRecord.startDate, ctx, req.user!.id);
  }

  const refreshed = await prisma.weekPlan.findUniqueOrThrow({ where: { id: planRecord.id }, include: { entries: true } });
  await respondHydrated(res, refreshed, ctx);
});

// Supprime le planning courant (cascade sur ses créneaux ; les décisions
// déjà journalisées sont détachées, pas supprimées — voir RecipeDecision
// dans schema.prisma) puis en régénère un frais, comme un premier GET /.
weekPlanRouter.post("/reset", requireAuth, async (req, res) => {
  const ctx = await loadContext(req.user!.id);
  if (!ctx) {
    res.status(200).json({ weekPlan: null, reason: NO_PROFILE_REASON });
    return;
  }
  if (ctx.recipes.length === 0) {
    res.status(200).json({ weekPlan: null, reason: NO_RECIPES_REASON });
    return;
  }

  await prisma.weekPlan.deleteMany({ where: { userId: req.user!.id } });
  const planRecord = await createFreshWeekPlan(req.user!.id, ctx);

  await respondHydrated(res, planRecord, ctx);
});
