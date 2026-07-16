import { useEffect, useState } from "react";
import { checkHealth, getMe, signOut } from "./api.js";
import type { User } from "./api.js";
import AuthPage from "./AuthPage.js";
import "./App.css";

type ConnectionState = "checking" | "connected" | "error";
type AuthState = "loading" | "authenticated" | "unauthenticated";

const FEATURES = [
  {
    icon: "📷",
    title: "Ajouter un repas",
    description: "Prends une photo, l'IA reconnaît le plat.",
  },
  {
    icon: "📖",
    title: "Historique",
    description: "Retrouve tous tes repas enregistrés.",
  },
  {
    icon: "📊",
    title: "Statistiques",
    description: "Visualise tes habitudes alimentaires.",
  },
];

export default function App() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    checkHealth()
      .then(() => setState("connected"))
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setAuthState(u ? "authenticated" : "unauthenticated");
      })
      .catch(() => setAuthState("unauthenticated"));
  }, []);

  async function handleLogout() {
    try {
      await signOut();
    } finally {
      setUser(null);
      setAuthState("unauthenticated");
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🍽️ MonApp</h1>
        <div className="header-actions">
          <span className={`status-badge ${state}`}>
            {state === "checking" && "Connexion…"}
            {state === "connected" && "✅ Back-end connecté"}
            {state === "error" && "❌ Back-end injoignable"}
          </span>
          {authState === "authenticated" && (
            <button className="logout-button" onClick={handleLogout}>
              {user?.email} · Se déconnecter
            </button>
          )}
        </div>
      </header>

      {authState === "loading" && <p>Chargement…</p>}

      {authState === "unauthenticated" && (
        <AuthPage
          onAuthenticated={(u) => {
            setUser(u);
            setAuthState("authenticated");
          }}
        />
      )}

      {authState === "authenticated" && (
        <>
          <section className="hero">
            <h2>Bienvenue 👋</h2>
            <p>Suis tes repas et découvre tes habitudes alimentaires, en toute simplicité.</p>
          </section>

          <section className="feature-grid">
            {FEATURES.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <span className="icon">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <span className="soon">Bientôt disponible</span>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
