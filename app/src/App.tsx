import { useEffect, useState } from "react";
import { checkHealth, getMe, getProfile, signOut } from "./api.js";
import type { NutritionProfile, User } from "./api.js";
import AuthPage from "./AuthPage.js";
import FridgePage from "./FridgePage.js";
import ScanPage from "./ScanPage.js";
import OnboardingPage from "./OnboardingPage.js";
import SettingsPage from "./SettingsPage.js";
import DashboardPage from "./DashboardPage.js";
import HomeProgress from "./HomeProgress.js";
import "./App.css";

type ConnectionState = "checking" | "connected" | "error";
type AuthState = "loading" | "authenticated" | "unauthenticated";
type Page = "home" | "fridge" | "scan" | "settings" | "dashboard";

const FEATURES: { icon: string; title: string; description: string; page?: Page }[] = [
  {
    icon: "🧊",
    title: "Frigo",
    description: "Parcours ce qu'il y a dans ton frigo.",
    page: "fridge",
  },
  {
    icon: "🏷️",
    title: "Scanner",
    description: "Scanne un code-barres pour ajouter un aliment au frigo.",
    page: "scan",
  },
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
    page: "dashboard",
  },
];

export default function App() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [profile, setProfile] = useState<NutritionProfile | null | undefined>(undefined);

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

  useEffect(() => {
    if (authState !== "authenticated") return;
    getProfile()
      .then(({ profile }) => setProfile(profile))
      .catch(() => setProfile(null));
  }, [authState]);

  async function handleLogout() {
    try {
      await signOut();
    } finally {
      setUser(null);
      setAuthState("unauthenticated");
      setProfile(undefined);
      setPage("home");
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
          {authState === "authenticated" && profile && (
            <button className="settings-button" onClick={() => setPage("settings")} aria-label="Paramètres">
              ⚙️
            </button>
          )}
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

      {authState === "authenticated" && profile === undefined && <p>Chargement…</p>}

      {authState === "authenticated" && profile === null && (
        <OnboardingPage onComplete={(savedProfile) => setProfile(savedProfile)} />
      )}

      {authState === "authenticated" && profile && page === "fridge" && (
        <FridgePage onBack={() => setPage("home")} />
      )}

      {authState === "authenticated" && profile && page === "scan" && (
        <ScanPage onBack={() => setPage("home")} />
      )}

      {authState === "authenticated" && profile && page === "settings" && (
        <SettingsPage onBack={() => setPage("home")} />
      )}

      {authState === "authenticated" && profile && page === "dashboard" && (
        <DashboardPage onBack={() => setPage("home")} />
      )}

      {authState === "authenticated" && profile && page === "home" && (
        <>
          <section className="hero">
            <h2>Bienvenue 👋</h2>
            <p>Suis tes repas et découvre tes habitudes alimentaires, en toute simplicité.</p>
          </section>

          {profile.goalMode !== "frigo_only" && <HomeProgress profile={profile} />}

          <section className="feature-grid">
            {FEATURES.map((feature) => (
              <article
                className={`feature-card ${feature.page ? "clickable" : ""}`}
                key={feature.title}
                onClick={feature.page ? () => setPage(feature.page!) : undefined}
              >
                <span className="icon">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                {!feature.page && <span className="soon">Bientôt disponible</span>}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
