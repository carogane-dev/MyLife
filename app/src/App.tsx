import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  Refrigerator,
  ScanLine,
  ChefHat,
  BookOpen,
  ShoppingCart,
  Camera,
  History,
  BarChart3,
  FlaskConical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { checkHealth, getMe, getProfile, signOut } from "./api.js";
import type { NutritionModeConfigEntry, NutritionProfile, User } from "./api.js";
import { calculateNutritionTargets } from "./nutritionCalculator.js";
import { useNutritionConfig } from "./useNutritionConfig.js";
import AuthPage from "./AuthPage.js";
import FridgePage from "./FridgePage.js";
import ScanPage from "./ScanPage.js";
import OnboardingPage from "./OnboardingPage.js";
import SettingsPage from "./SettingsPage.js";
import DashboardPage from "./DashboardPage.js";
import HomeProgress from "./HomeProgress.js";
import MealBuilderPage from "./MealBuilderPage.js";
import RecipesPage from "./RecipesPage.js";
import WeekPlanPage from "./WeekPlanPage.js";
import ScientificDataPage from "./ScientificDataPage.js";
import GamificationSummary from "./GamificationSummary.js";
import AddMealPage from "./AddMealPage.js";
import HistoryPage from "./HistoryPage.js";
import CoursesPage from "./CoursesPage.js";
import BottomTabBar from "./BottomTabBar.js";
import Skeleton from "./Skeleton.js";
import DayOverview from "./DayOverview.js";
import FridgeAutonomyWidget from "./FridgeAutonomyWidget.js";
import WeekDayStrip from "./WeekDayStrip.js";
import "./App.css";

type ConnectionState = "checking" | "connected" | "error";
type AuthState = "loading" | "authenticated" | "unauthenticated";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  path: string;
  tint: "green" | "coral" | "amber" | "blue";
}

interface FeatureGroup {
  label: string;
  features: Feature[];
}

// Regroupées par usage plutôt qu'en grille plate : chaque groupe partage
// une teinte de pastille, pour repérer d'un coup d'œil "à quoi ça sert"
// avant même de lire le libellé. L'accès rapide aux fonctions les plus
// fréquentes (Accueil/Frigo/Repas/Planning/Profil) reste dans la barre du
// bas (BottomTabBar) — ces groupes couvrent le reste.
const FEATURE_GROUPS: FeatureGroup[] = [
  {
    label: "Frigo",
    features: [
      { icon: Refrigerator, title: "Frigo", description: "Parcours ce qu'il y a dans ton frigo.", path: "/frigo", tint: "green" },
      { icon: ScanLine, title: "Scanner", description: "Ajoute un aliment par code-barres.", path: "/scan", tint: "green" },
    ],
  },
  {
    label: "Repas",
    features: [
      { icon: ChefHat, title: "Composer un repas", description: "Construit un repas équilibré à partir de ton frigo.", path: "/meal-builder", tint: "coral" },
      { icon: BookOpen, title: "Recettes", description: "Découvre et partage des recettes avec la communauté.", path: "/recipes", tint: "coral" },
      { icon: Camera, title: "Ajouter un repas", description: "Prends une photo, l'IA reconnaît le plat.", path: "/add-meal", tint: "coral" },
    ],
  },
  {
    label: "Planning",
    features: [
      { icon: ShoppingCart, title: "Courses", description: "Ce qu'il te manque pour la semaine, et les repas à construire toi-même.", path: "/courses", tint: "blue" },
    ],
  },
  {
    label: "Suivi",
    features: [
      { icon: History, title: "Historique", description: "Retrouve tous tes repas enregistrés.", path: "/history", tint: "amber" },
      { icon: BarChart3, title: "Statistiques", description: "Visualise tes habitudes alimentaires.", path: "/dashboard", tint: "amber" },
      { icon: FlaskConical, title: "Données scientifiques", description: "Les repères utilisés pour calculer tes objectifs et composer tes repas.", path: "/scientific-data", tint: "amber" },
    ],
  },
];

// Pas de champ "prénom" dans le modèle User (juste email) — dérivé de la
// partie locale de l'adresse plutôt que d'ajouter un champ dédié, hors
// scope d'une refonte visuelle.
function firstNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._\d]/)[0];
  if (!first) return "";
  return first[0].toUpperCase() + first.slice(1);
}

function HomeContent({
  email,
  profile,
  modeConfigs,
}: {
  email: string;
  profile: NutritionProfile;
  modeConfigs: NutritionModeConfigEntry[];
}) {
  const navigate = useNavigate();
  const name = firstNameFromEmail(email);
  const targets = profile.goalMode !== "frigo_only" ? calculateNutritionTargets(profile, modeConfigs) : null;

  return (
    <>
      <section className="home-intro">
        <h2>{name ? `Bonjour ${name}` : "Bonjour"}</h2>
        <p className="home-intro-status">
          {targets ? `Objectif du jour : ${targets.targetCalories} kcal` : "Ton frigo t'attend."}
        </p>
      </section>

      {profile.goalMode !== "frigo_only" && <WeekDayStrip profile={profile} />}
      {profile.goalMode !== "frigo_only" && <DayOverview />}
      {profile.goalMode !== "frigo_only" && <FridgeAutonomyWidget />}
      {profile.goalMode !== "frigo_only" && <HomeProgress profile={profile} />}
      <GamificationSummary />

      <div className="home-divider">
        <span>Fonctions en test</span>
      </div>

      {FEATURE_GROUPS.map((group) => (
        <section className="feature-group" key={group.label}>
          <p className="feature-group-label">{group.label}</p>
          <div className="feature-grid">
            {group.features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  className="feature-card clickable"
                  key={feature.title}
                  onClick={() => navigate(feature.path)}
                >
                  <div className={`feature-card-icon tint-${feature.tint}`}>
                    <Icon size={22} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

export default function App() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<NutritionProfile | null | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const { modeConfigs } = useNutritionConfig();

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
      navigate("/");
    }
  }

  const goHome = () => navigate("/");
  const ready = authState === "authenticated" && !!profile;

  return (
    <div className={`app ${ready ? "has-bottom-nav" : ""}`}>
      <header className="app-header">
        <h1>MonApp</h1>
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

      {authState === "loading" && (
        <div className="skeleton-stack">
          <Skeleton height="24px" width="40%" />
          <Skeleton height="80px" />
        </div>
      )}

      {authState === "unauthenticated" && (
        <AuthPage
          onAuthenticated={(u) => {
            setUser(u);
            setAuthState("authenticated");
          }}
        />
      )}

      {authState === "authenticated" && profile === undefined && (
        <div className="skeleton-stack">
          <Skeleton height="24px" width="40%" />
          <Skeleton height="120px" />
        </div>
      )}

      {authState === "authenticated" && profile === null && (
        <OnboardingPage onComplete={(savedProfile) => setProfile(savedProfile)} />
      )}

      {ready && profile && (
        <div key={location.pathname} className="page-transition">
          <Routes>
            <Route
              path="/"
              element={<HomeContent email={user?.email ?? ""} profile={profile} modeConfigs={modeConfigs} />}
            />
            <Route path="/frigo" element={<FridgePage onBack={goHome} />} />
            <Route path="/scan" element={<ScanPage onBack={goHome} />} />
            <Route path="/settings" element={<SettingsPage onBack={goHome} />} />
            <Route path="/dashboard" element={<DashboardPage onBack={goHome} />} />
            <Route path="/meal-builder" element={<MealBuilderPage onBack={goHome} />} />
            <Route path="/recipes" element={<RecipesPage onBack={goHome} />} />
            <Route path="/week-plan" element={<WeekPlanPage onBack={goHome} />} />
            <Route path="/courses" element={<CoursesPage onBack={goHome} />} />
            <Route path="/scientific-data" element={<ScientificDataPage onBack={goHome} />} />
            <Route path="/add-meal" element={<AddMealPage onBack={goHome} />} />
            <Route path="/history" element={<HistoryPage onBack={goHome} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      )}

      {ready && <BottomTabBar />}
    </div>
  );
}
