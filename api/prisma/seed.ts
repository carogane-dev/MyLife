import "dotenv/config";
import { prisma } from "../src/db.js";

const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL;

const FRIDGE_ITEMS: Array<{
  category: string;
  subcategory: string;
  name: string;
  quantity: number;
  unit: string;
}> = [
  { category: "Fromage", subcategory: "Chèvre", name: "Crottin de Chavignol", quantity: 2, unit: "pièce" },
  { category: "Fromage", subcategory: "Chèvre", name: "Bûche de chèvre", quantity: 200, unit: "g" },
  { category: "Fromage", subcategory: "Vache", name: "Comté", quantity: 300, unit: "g" },
  { category: "Fromage", subcategory: "Vache", name: "Camembert", quantity: 1, unit: "pièce" },
  { category: "Fromage", subcategory: "Vache", name: "Emmental râpé", quantity: 150, unit: "g" },

  { category: "Viande", subcategory: "Bœuf", name: "Steak haché", quantity: 500, unit: "g" },
  { category: "Viande", subcategory: "Bœuf", name: "Entrecôte", quantity: 2, unit: "pièce" },
  { category: "Viande", subcategory: "Volaille", name: "Blanc de poulet", quantity: 400, unit: "g" },
  { category: "Viande", subcategory: "Volaille", name: "Cuisses de poulet", quantity: 4, unit: "pièce" },

  { category: "Légume", subcategory: "Racine", name: "Carottes", quantity: 1, unit: "kg" },
  { category: "Légume", subcategory: "Racine", name: "Pommes de terre", quantity: 2, unit: "kg" },
  { category: "Légume", subcategory: "Feuille", name: "Salade verte", quantity: 1, unit: "pièce" },
  { category: "Légume", subcategory: "Feuille", name: "Épinards", quantity: 250, unit: "g" },

  { category: "Fruit", subcategory: "Agrume", name: "Oranges", quantity: 6, unit: "pièce" },
  { category: "Fruit", subcategory: "Agrume", name: "Citrons", quantity: 3, unit: "pièce" },
  { category: "Fruit", subcategory: "Pomme et poire", name: "Pommes Gala", quantity: 8, unit: "pièce" },
  { category: "Fruit", subcategory: "Pomme et poire", name: "Poires", quantity: 4, unit: "pièce" },
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
    data: FRIDGE_ITEMS.map((item) => ({ ...item, userId: user.id })),
  });
  console.log(`${FRIDGE_ITEMS.length} article(s) de frigo créés pour ${SEED_USER_EMAIL}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
