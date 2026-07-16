import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { prisma } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { fridgeRouter } from "./routes/fridge.js";
import { profileRouter } from "./routes/profile.js";
import { consumptionRouter } from "./routes/consumption.js";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser(process.env.SESSION_COOKIE_SECRET));
app.use("/api/auth", authRouter);
app.use("/api/fridge", fridgeRouter);
app.use("/api/profile", profileRouter);
app.use("/api/consumption", consumptionRouter);

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
