import type { NutritionModeConfigEntry, NutritionTargets } from "./nutritionCalculator.js";

// Chemin relatif : passe par le proxy Vite (voir vite.config.ts) qui redirige
// /api vers le back-end. Fonctionne pareil en local, sur le réseau local
// (IP du PC) ou via un tunnel HTTPS, sans jamais coder une adresse en dur.
const API_BASE_URL = "";

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface FridgeItem {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  quantity: number;
  unit: string;
  barcode: string | null;
  unitWeightGrams: number | null;
  compatibleSlots: MealSlot[];
  expiresAt: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  nutritionEstimated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumptionEntry {
  id: string;
  fridgeItemId: string | null;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  consumedAt: string;
}

export interface MealSuggestionItem {
  fridgeItemId: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface MealSuggestion {
  items: MealSuggestionItem[];
  totals: { calories: number; protein: number; fat: number; carbs: number };
}

export type { NutritionTargets, NutritionModeConfigEntry } from "./nutritionCalculator.js";

// Miroir de api/src/mealSlots.ts : le créneau est toujours choisi par
// l'utilisateur côté front (pré-sélectionné selon l'heure locale), jamais
// déduit côté serveur.
export type MealSlot = "petit-dejeuner" | "dejeuner" | "diner";
export const MEAL_SLOTS: MealSlot[] = ["petit-dejeuner", "dejeuner", "diner"];

export interface NutritionBenchmark {
  carbPercentMin: number;
  carbPercentMax: number;
  fatPercentMin: number;
  fatPercentMax: number;
  proteinPercentMin: number;
  proteinPercentMax: number;
  issnProteinPerKgMin: number;
  issnProteinPerKgMax: number;
  defaultBreakfastPercent: number;
  defaultLunchPercent: number;
  defaultDinnerPercent: number;
}

export interface NutritionProfile {
  id: string;
  sex: "homme" | "femme" | "autre";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentaire" | "leger" | "modere" | "actif" | "tres_actif";
  goalMode: "frigo_only" | "chill" | "ligne" | "elite";
  bodyType: "endurance" | "athletic" | "mass" | null;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionProfileDraft {
  sex: "homme" | "femme" | "autre";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentaire" | "leger" | "modere" | "actif" | "tres_actif";
  goalMode: "frigo_only" | "chill" | "ligne" | "elite";
  bodyType: "endurance" | "athletic" | "mass" | null;
}

export interface FridgeItemDraft {
  barcode?: string | null;
  name: string;
  category: string;
  subcategory: string;
  quantity: number;
  unit: string;
  unitWeightGrams: number | null;
  compatibleSlots?: MealSlot[];
  expiresAt: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  nutritionEstimated: boolean;
}

async function parseJsonOrThrow(res: Response) {
  if (!res.ok) {
    let message = "Une erreur est survenue.";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // réponse sans corps JSON exploitable, on garde le message générique
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error("API injoignable");
  return res.json();
}

export async function signUp(email: string, password: string): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseJsonOrThrow(res);
}

export async function signIn(email: string, password: string): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseJsonOrThrow(res);
}

export async function signOut(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  await parseJsonOrThrow(res);
}

export async function getMe(): Promise<User | null> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "GET",
    credentials: "include",
  });
  if (res.status === 401) return null;
  const body = await parseJsonOrThrow(res);
  return body.user;
}

export async function getFridgeItems(): Promise<FridgeItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/fridge`, {
    method: "GET",
    credentials: "include",
  });
  const body = await parseJsonOrThrow(res);
  return body.items;
}

export async function lookupBarcode(barcode: string): Promise<FridgeItemDraft> {
  const res = await fetch(`${API_BASE_URL}/api/fridge/lookup/${encodeURIComponent(barcode)}`, {
    method: "GET",
    credentials: "include",
  });
  const body = await parseJsonOrThrow(res);
  return body.item;
}

export async function createFridgeItem(draft: FridgeItemDraft): Promise<FridgeItem> {
  const res = await fetch(`${API_BASE_URL}/api/fridge`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const body = await parseJsonOrThrow(res);
  return body.item;
}

export async function updateFridgeItem(id: string, draft: FridgeItemDraft): Promise<FridgeItem> {
  const res = await fetch(`${API_BASE_URL}/api/fridge/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const body = await parseJsonOrThrow(res);
  return body.item;
}

export async function deleteFridgeItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/fridge/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseJsonOrThrow(res);
}

export async function markItemEaten(
  fridgeItemId: string,
  quantity: number,
  mealSlot?: MealSlot
): Promise<{ entry: ConsumptionEntry; itemDeleted: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/consumption`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fridgeItemId, quantity, mealSlot }),
  });
  return parseJsonOrThrow(res);
}

export async function logManualConsumption(
  entry: {
    name: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  },
  mealSlot?: MealSlot
): Promise<{ entry: ConsumptionEntry }> {
  const res = await fetch(`${API_BASE_URL}/api/consumption/manual`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...entry, mealSlot }),
  });
  return parseJsonOrThrow(res);
}

export async function getConsumptionEntries(from: string, to: string): Promise<ConsumptionEntry[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/consumption?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { method: "GET", credentials: "include" }
  );
  const body = await parseJsonOrThrow(res);
  return body.entries;
}

export async function simulateNewDay(): Promise<{ shifted: number }> {
  const res = await fetch(`${API_BASE_URL}/api/consumption/simulate-new-day`, {
    method: "POST",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

export async function getMealSuggestion(
  excludeIds: string[] = [],
  slot: MealSlot = "dejeuner",
  mealsRemaining = 3
): Promise<{ suggestion: MealSuggestion | null; reason?: string }> {
  const params = new URLSearchParams();
  if (excludeIds.length > 0) params.set("exclude", excludeIds.join(","));
  params.set("slot", slot);
  params.set("meals", String(mealsRemaining));
  const res = await fetch(`${API_BASE_URL}/api/meal-suggestion?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

export interface RecipeMatchIngredient {
  name: string;
  displayQuantity: number;
  displayUnit: string;
  flexible: boolean;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface RecipeMatch {
  recipeId: string;
  recipeName: string;
  ingredients: RecipeMatchIngredient[];
  totals: { calories: number; protein: number; fat: number; carbs: number };
  // true si l'historique accepter/refuser de l'utilisateur montre qu'il
  // apprécie souvent cette recette (voir recipeMatcher.computeAffinityScores
  // côté backend) — sert uniquement au badge "❤️ Souvent accepté".
  liked: boolean;
}

export async function getRecipeSuggestion(
  excludeIds: string[] = [],
  slot: MealSlot = "dejeuner",
  mealsRemaining = 3
): Promise<{ match: RecipeMatch | null; reason?: string }> {
  const params = new URLSearchParams();
  if (excludeIds.length > 0) params.set("exclude", excludeIds.join(","));
  params.set("slot", slot);
  params.set("meals", String(mealsRemaining));
  const res = await fetch(`${API_BASE_URL}/api/recipes/suggestion/for-meal?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

export interface MissingIngredient {
  name: string;
  displayQuantity: number;
  displayUnit: string;
  grams: number;
}

export type WeekPlanEntryStatus = "proposed" | "accepted" | "eaten" | "exhausted";

export interface WeekPlanSlotAssignment {
  date: string;
  slot: MealSlot;
  match: RecipeMatch | null;
  stockCovered: boolean;
  missingIngredients: MissingIngredient[];
  entryId: string;
  status: WeekPlanEntryStatus;
  attempts: number;
}

export interface WeekPlanDay {
  date: string;
  slots: WeekPlanSlotAssignment[];
}

export interface ShoppingListItem {
  name: string;
  totalNeededGrams: number;
  totalShortfallGrams: number;
}

export interface WeekPlan {
  days: WeekPlanDay[];
  coverage: { total: number; covered: number };
  shoppingList: ShoppingListItem[];
}

type WeekPlanResult = { weekPlan: WeekPlan | null; reason?: string };

// Récupère le planning persisté en cours de l'utilisateur (le crée s'il
// n'en a pas encore, ou si celui qu'il avait porte sur une semaine déjà
// entièrement passée) — les décisions accepter/refuser/manger survivent
// donc à un rechargement de page.
export async function getWeekPlan(): Promise<WeekPlanResult> {
  const res = await fetch(`${API_BASE_URL}/api/week-plan`, {
    method: "GET",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

// Accepte la recette actuellement proposée pour ce créneau.
export async function acceptWeekPlanEntry(entryId: string): Promise<WeekPlanResult> {
  const res = await fetch(`${API_BASE_URL}/api/week-plan/entries/${encodeURIComponent(entryId)}/accept`, {
    method: "POST",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

// Refuse la recette actuellement proposée pour ce créneau : régénère une
// alternative (jamais déjà refusée pour ce créneau), ou passe le créneau à
// "exhausted" après 5 refus.
export async function rejectWeekPlanEntry(entryId: string): Promise<WeekPlanResult> {
  const res = await fetch(`${API_BASE_URL}/api/week-plan/entries/${encodeURIComponent(entryId)}/reject`, {
    method: "POST",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

// Marque un créneau accepté/épuisé comme mangé — le front doit d'abord
// journaliser la consommation elle-même via logManualConsumption.
export async function markWeekPlanEntryEaten(entryId: string): Promise<WeekPlanResult> {
  const res = await fetch(`${API_BASE_URL}/api/week-plan/entries/${encodeURIComponent(entryId)}/mark-eaten`, {
    method: "POST",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

// Applique la même logique que le refus à tous les créneaux encore
// "proposed" de ce jour (ignore les créneaux déjà acceptés/mangés/épuisés).
export async function regenerateWeekPlanDay(date: string): Promise<WeekPlanResult> {
  const res = await fetch(`${API_BASE_URL}/api/week-plan/days/${encodeURIComponent(date)}/regenerate-remaining`, {
    method: "POST",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

// Supprime le planning courant et en régénère un frais (les décisions déjà
// journalisées sont conservées pour l'apprentissage futur des goûts).
export async function resetWeekPlan(): Promise<WeekPlanResult> {
  const res = await fetch(`${API_BASE_URL}/api/week-plan/reset`, {
    method: "POST",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

export async function getProfile(): Promise<{ profile: NutritionProfile | null; targets: NutritionTargets | null }> {
  const res = await fetch(`${API_BASE_URL}/api/profile`, {
    method: "GET",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

export async function getNutritionConfig(): Promise<{ modeConfigs: NutritionModeConfigEntry[]; benchmark: NutritionBenchmark }> {
  const res = await fetch(`${API_BASE_URL}/api/nutrition-config`, {
    method: "GET",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

export async function saveProfile(draft: NutritionProfileDraft): Promise<NutritionProfile> {
  const res = await fetch(`${API_BASE_URL}/api/profile`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const body = await parseJsonOrThrow(res);
  return body.profile;
}

// ===== Recettes =====

export interface RecipeSummary {
  id: string;
  name: string;
  description: string | null;
  category: string;
  healthy: boolean;
  difficulty: string;
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  servings: number;
  compatibleSlots: MealSlot[];
  ingredientCount: number;
  likeCount: number;
  likedByMe: boolean;
  macrosPerServing: { calories: number; protein: number; fat: number; carbs: number };
  createdAt: string;
}

export interface RecipeIngredient {
  id?: string;
  name: string;
  displayQuantity: number;
  displayUnit: string;
  referenceGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  flexible: boolean;
}

export interface RecipeDetail {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  category: string;
  healthy: boolean;
  difficulty: string;
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  servings: number;
  compatibleSlots: MealSlot[];
  authorEmail: string;
  isAuthor: boolean;
  ingredients: RecipeIngredient[];
  likeCount: number;
  likedByMe: boolean;
  macrosTotal: { calories: number; protein: number; fat: number; carbs: number };
  macrosPerServing: { calories: number; protein: number; fat: number; carbs: number };
}

export interface RecipeDraft {
  name: string;
  description: string;
  instructions: string;
  category: string;
  healthy: boolean;
  difficulty: string;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  compatibleSlots: MealSlot[];
  ingredients: RecipeIngredient[];
}

export interface RecipeFilters {
  q?: string;
  category?: string;
  healthy?: boolean;
  difficulty?: string;
  ingredient?: string;
  sort?: "likes" | "time" | "recent";
}

export async function getRecipes(filters: RecipeFilters = {}): Promise<RecipeSummary[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.healthy !== undefined) params.set("healthy", String(filters.healthy));
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.ingredient) params.set("ingredient", filters.ingredient);
  if (filters.sort) params.set("sort", filters.sort);
  const res = await fetch(`${API_BASE_URL}/api/recipes?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  const body = await parseJsonOrThrow(res);
  return body.recipes;
}

export async function getRecipe(id: string): Promise<RecipeDetail> {
  const res = await fetch(`${API_BASE_URL}/api/recipes/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
  });
  const body = await parseJsonOrThrow(res);
  return body.recipe;
}

export async function createRecipe(draft: RecipeDraft): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/recipes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const body = await parseJsonOrThrow(res);
  return body.recipe;
}

export async function updateRecipe(id: string, draft: RecipeDraft): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/recipes/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const body = await parseJsonOrThrow(res);
  return body.recipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/recipes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseJsonOrThrow(res);
}

export async function toggleRecipeLike(id: string): Promise<{ liked: boolean; likeCount: number }> {
  const res = await fetch(`${API_BASE_URL}/api/recipes/${encodeURIComponent(id)}/like`, {
    method: "POST",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

// ===== Gamification =====

export interface GamificationBadge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
}

export interface GamificationSummary {
  streak: { currentDays: number | null; bestDays: number | null };
  totalPoints: number;
  level: number;
  mealsLogged: number;
  badges: GamificationBadge[];
}

export async function getGamificationSummary(): Promise<GamificationSummary> {
  const res = await fetch(`${API_BASE_URL}/api/gamification`, {
    method: "GET",
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}
