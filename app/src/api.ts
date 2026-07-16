// URL du back-end : à ajuster selon l'environnement (dev local, mobile, prod)
const API_BASE_URL = "http://localhost:3001";

export interface User {
  id: string;
  email: string;
  createdAt: string;
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
