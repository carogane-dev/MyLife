import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Route de santé : sert à vérifier que le back répond (utilisée par le front au démarrage)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Route de santé DB : vérifie que la connexion Postgres fonctionne
app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", message: (err as Error).message });
  }
});

// Squelette de la future route de reconnaissance de plats
// (pour l'instant : liste vide, on branchera l'IA vision dans une prochaine étape)
app.get("/api/meals", async (_req, res) => {
  const meals = await prisma.mealEntry.findMany({ orderBy: { eatenAt: "desc" }, take: 20 });
  res.json(meals);
});

app.listen(PORT, () => {
  console.log(`API démarrée sur http://localhost:${PORT}`);
});
