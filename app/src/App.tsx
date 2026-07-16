import { useEffect, useState } from "react";
import { checkHealth } from "./api.js";

type ConnectionState = "checking" | "connected" | "error";

export default function App() {
  const [state, setState] = useState<ConnectionState>("checking");

  useEffect(() => {
    checkHealth()
      .then(() => setState("connected"))
      .catch(() => setState("error"));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>MonApp</h1>
      {state === "checking" && <p>Vérification de la connexion au back-end…</p>}
      {state === "connected" && <p style={{ color: "green" }}>✅ Connecté au back-end</p>}
      {state === "error" && (
        <p style={{ color: "red" }}>
          ❌ Impossible de joindre le back-end. Vérifie qu'il tourne bien sur le port 3001.
        </p>
      )}
    </div>
  );
}
