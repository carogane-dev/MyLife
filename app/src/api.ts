import type { NutritionTargets } from "./nutritionCalculator.js";

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

export type { NutritionTargets } from "./nutritionCalculator.js";

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
  quantity: number
): Promise<{ entry: ConsumptionEntry; itemDeleted: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/consumption`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fridgeItemId, quantity }),
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
  mealsRemaining = 3
): Promise<{ suggestion: MealSuggestion | null; reason?: string }> {
  const params = new URLSearchParams();
  if (excludeIds.length > 0) params.set("exclude", excludeIds.join(","));
  params.set("meals", String(mealsRemaining));
  const res = await fetch(`${API_BASE_URL}/api/meal-suggestion?${params.toString()}`, {
    method: "GET",
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
