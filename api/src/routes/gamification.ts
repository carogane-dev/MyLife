import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { computeGamificationSummary } from "../gamification.js";

export const gamificationRouter = Router();

gamificationRouter.get("/", requireAuth, async (req, res) => {
  const summary = await computeGamificationSummary(req.user!.id);
  res.status(200).json(summary);
});
