import { PrismaClient } from "@prisma/client";

// Instance unique du client Prisma, réutilisée dans toute l'app
export const prisma = new PrismaClient();
