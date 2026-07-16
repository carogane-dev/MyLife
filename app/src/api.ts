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
  expiresAt: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  nutritionEstimated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionProfile {
  id: string;
  sex: "homme" | "femme" | "autre";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentaire" | "leger" | "modere" | "actif" | "tres_actif";
  createdAt: string;
  updatedAt: string;
}

export interface NutritionProfileDraft {
  sex: "homme" | "femme" | "autre";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentaire" | "leger" | "modere" | "actif" | "tres_actif";
}

export interface FridgeItemDraft {
  barcode: string;
  name: string;
  category: string;
  subcategory: string;
  quantity: number;
  unit: string;
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

export async function getProfile(): Promise<NutritionProfile | null> {
  const res = await fetch(`${API_BASE_URL}/api/profile`, {
    method: "GET",
    credentials: "include",
  });
  const body = await parseJsonOrThrow(res);
  return body.profile;
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
