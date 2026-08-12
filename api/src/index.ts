import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { prisma } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { fridgeRouter } from "./routes/fridge.js";
import { profileRouter } from "./routes/profile.js";
import { consumptionRouter } from "./routes/consumption.js";
import { mealSuggestionRouter } from "./routes/mealSuggestion.js";
import { recipesRouter } from "./routes/recipes.js";
import { nutritionConfigRouter } from "./routes/nutritionConfig.js";
import { weekPlanRouter } from "./routes/weekPlan.js";
import { gamificationRouter } from "./routes/gamification.js";
import { mealsRouter } from "./routes/meals.js";

const app = express();
// CORS_ORIGIN accepte une liste séparée par des virgules — nécessaire dès
// qu'on ajoute un second frontend (ex. l'app desktop Tauri packagée, voir
// app/src-tauri/) qui ne charge plus depuis http://localhost:5173 mais
// depuis son propre protocole interne (ex. https://tauri.localhost sur
// Windows) : à renseigner dans api/.env le jour où `tauri build` est
// réellement testé (voir CLAUDE.md, section packaging desktop).
const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim());
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
// 10mb : accueille une photo encodée en base64 pour la reconnaissance de
// plats (routes/meals.ts) — le défaut d'express.json() (100kb) est trop
// bas pour une photo de téléphone.
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser(process.env.SESSION_COOKIE_SECRET));
app.use("/api/auth", authRouter);
app.use("/api/fridge", fridgeRouter);
app.use("/api/profile", profileRouter);
app.use("/api/consumption", consumptionRouter);
app.use("/api/meal-suggestion", mealSuggestionRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/nutrition-config", nutritionConfigRouter);
app.use("/api/week-plan", weekPlanRouter);
app.use("/api/gamification", gamificationRouter);
app.use("/api/meals", mealsRouter);

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

app.listen(PORT, () => {
  console.log(`API démarrée sur http://localhost:${PORT}`);
});
