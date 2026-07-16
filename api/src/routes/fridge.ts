import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const fridgeRouter = Router();

// TODO: ajouter POST / PATCH / DELETE quand la fonctionnalité de scan photo
// et l'édition manuelle de l'inventaire seront implémentées.
fridgeRouter.get("/", requireAuth, async (req, res) => {
  const items = await prisma.fridgeItem.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ category: "asc" }, { subcategory: "asc" }, { name: "asc" }],
  });
  res.status(200).json({ items });
});
