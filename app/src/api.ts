// URL du back-end : à ajuster selon l'environnement (dev local, mobile, prod)
const API_BASE_URL = "http://localhost:3001";

export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error("API injoignable");
  return res.json();
}
