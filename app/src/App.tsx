import { useEffect, useState } from "react";
import { checkHealth } from "./api.js";
import "./App.css";

type ConnectionState = "checking" | "connected" | "error";

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

  useEffect(() => {
    checkHealth()
      .then(() => setState("connected"))
      .catch(() => setState("error"));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🍽️ MonApp</h1>
        <span className={`status-badge ${state}`}>
          {state === "checking" && "Connexion…"}
          {state === "connected" && "✅ Back-end connecté"}
          {state === "error" && "❌ Back-end injoignable"}
        </span>
      </header>

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
    </div>
  );
}
