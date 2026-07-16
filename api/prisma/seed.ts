import "dotenv/config";
import { prisma } from "../src/db.js";

const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

const FRIDGE_ITEMS: Array<{
  category: string;
  subcategory: string;
  name: string;
  quantity: number;
  unit: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  expiresAt: Date;
}> = [
  { category: "Produit laitier", subcategory: "Chèvre", name: "Crottin de Chavignol", quantity: 2, unit: "pièce", caloriesPer100g: 330, proteinPer100g: 20, fatPer100g: 27, carbsPer100g: 1, expiresAt: daysFromNow(-3) },
  { category: "Produit laitier", subcategory: "Chèvre", name: "Bûche de chèvre", quantity: 200, unit: "g", caloriesPer100g: 290, proteinPer100g: 18, fatPer100g: 24, carbsPer100g: 1, expiresAt: daysFromNow(10) },
  { category: "Produit laitier", subcategory: "Vache", name: "Comté", quantity: 300, unit: "g", caloriesPer100g: 410, proteinPer100g: 27, fatPer100g: 33, carbsPer100g: 0, expiresAt: daysFromNow(45) },
  { category: "Produit laitier", subcategory: "Vache", name: "Camembert", quantity: 1, unit: "pièce", caloriesPer100g: 300, proteinPer100g: 20, fatPer100g: 24, carbsPer100g: 0.5, expiresAt: daysFromNow(5) },
  { category: "Produit laitier", subcategory: "Vache", name: "Emmental râpé", quantity: 150, unit: "g", caloriesPer100g: 380, proteinPer100g: 28, fatPer100g: 30, carbsPer100g: 0, expiresAt: daysFromNow(60) },

  { category: "Viande", subcategory: "Bœuf", name: "Steak haché", quantity: 500, unit: "g", caloriesPer100g: 200, proteinPer100g: 19, fatPer100g: 13, carbsPer100g: 0, expiresAt: daysFromNow(2) },
  { category: "Viande", subcategory: "Bœuf", name: "Entrecôte", quantity: 2, unit: "pièce", caloriesPer100g: 250, proteinPer100g: 26, fatPer100g: 16, carbsPer100g: 0, expiresAt: daysFromNow(15) },
  { category: "Viande", subcategory: "Volaille", name: "Blanc de poulet", quantity: 400, unit: "g", caloriesPer100g: 110, proteinPer100g: 23, fatPer100g: 1.5, carbsPer100g: 0, expiresAt: daysFromNow(3) },
  { category: "Viande", subcategory: "Volaille", name: "Cuisses de poulet", quantity: 4, unit: "pièce", caloriesPer100g: 180, proteinPer100g: 18, fatPer100g: 12, carbsPer100g: 0, expiresAt: daysFromNow(4) },

  { category: "Légume", subcategory: "Racine", name: "Carottes", quantity: 1, unit: "kg", caloriesPer100g: 41, proteinPer100g: 0.9, fatPer100g: 0.2, carbsPer100g: 10, expiresAt: daysFromNow(20) },
  { category: "Légume", subcategory: "Racine", name: "Pommes de terre", quantity: 2, unit: "kg", caloriesPer100g: 77, proteinPer100g: 2, fatPer100g: 0.1, carbsPer100g: 17, expiresAt: daysFromNow(30) },
  { category: "Légume", subcategory: "Feuille", name: "Salade verte", quantity: 1, unit: "pièce", caloriesPer100g: 15, proteinPer100g: 1.4, fatPer100g: 0.2, carbsPer100g: 2.9, expiresAt: daysFromNow(1) },
  { category: "Légume", subcategory: "Feuille", name: "Épinards", quantity: 250, unit: "g", caloriesPer100g: 23, proteinPer100g: 2.9, fatPer100g: 0.4, carbsPer100g: 3.6, expiresAt: daysFromNow(6) },

  { category: "Fruit", subcategory: "Agrume", name: "Oranges", quantity: 6, unit: "pièce", caloriesPer100g: 47, proteinPer100g: 0.9, fatPer100g: 0.1, carbsPer100g: 12, expiresAt: daysFromNow(12) },
  { category: "Fruit", subcategory: "Agrume", name: "Citrons", quantity: 3, unit: "pièce", caloriesPer100g: 29, proteinPer100g: 1.1, fatPer100g: 0.3, carbsPer100g: 9, expiresAt: daysFromNow(25) },
  { category: "Fruit", subcategory: "Pomme et poire", name: "Pommes Gala", quantity: 8, unit: "pièce", caloriesPer100g: 52, proteinPer100g: 0.3, fatPer100g: 0.2, carbsPer100g: 14, expiresAt: daysFromNow(40) },
  { category: "Fruit", subcategory: "Pomme et poire", name: "Poires", quantity: 4, unit: "pièce", caloriesPer100g: 57, proteinPer100g: 0.4, fatPer100g: 0.1, carbsPer100g: 15, expiresAt: daysFromNow(18) },
];

async function main() {
  if (!SEED_USER_EMAIL) {
    console.log("SEED_USER_EMAIL n'est pas défini dans .env, on ne seed rien.");
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: SEED_USER_EMAIL } });
  if (!user) {
    console.log(`Aucun utilisateur avec l'email ${SEED_USER_EMAIL}, on ne seed rien.`);
    return;
  }

  const existing = await prisma.fridgeItem.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(`L'utilisateur ${SEED_USER_EMAIL} a déjà ${existing} article(s) de frigo, on ne reseed pas.`);
    return;
  }

  await prisma.fridgeItem.createMany({
    data: FRIDGE_ITEMS.map((item) => ({ ...item, userId: user.id, nutritionEstimated: true })),
  });
  console.log(`${FRIDGE_ITEMS.length} article(s) de frigo créés pour ${SEED_USER_EMAIL}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
