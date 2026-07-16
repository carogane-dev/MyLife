import type { DisplayCategory, NutritionBucket } from "./nutritionDefaults.js";
import type { OffProduct } from "./offClient.js";

interface CategoryRule {
  keywords: string[];
  category: DisplayCategory;
  nutritionBucket: NutritionBucket;
  // Sous-catégorie fixe (ex. les œufs n'ont pas besoin d'un tag OFF plus
  // précis) ; sinon on dérive du tag OFF le plus spécifique.
  fixedSubcategory?: string;
}

// Ordre de priorité volontaire : résout les ambiguïtés (ex. un produit
// laitier sucré ne doit pas être pris pour un fromage juste parce qu'il
// contient "milk" dans un tag secondaire).
const CATEGORY_RULES: CategoryRule[] = [
  { keywords: ["cheese", "fromage"], category: "Produit laitier", nutritionBucket: "Fromage" },
  { keywords: ["egg", "oeuf"], category: "Produit laitier", nutritionBucket: "Œufs", fixedSubcategory: "Œufs" },
  {
    keywords: ["dairies", "dairy", "produits-laitiers", "milk", "lait", "yaourt", "yogurt", "cream", "creme", "butter", "beurre"],
    category: "Produit laitier",
    nutritionBucket: "Produit laitier",
  },
  {
    keywords: [
      "meat",
      "viande",
      "charcuterie",
      "poulet",
      "chicken",
      "beef",
      "boeuf",
      "bœuf",
      "porc",
      "pork",
      "sausage",
      "saucisse",
      "jambon",
      "ham",
    ],
    category: "Viande",
    nutritionBucket: "Viande",
  },
  {
    keywords: ["fish", "poisson", "seafood", "fruits-de-mer", "salmon", "saumon", "tuna", "thon"],
    category: "Poisson",
    nutritionBucket: "Poisson",
  },
  { keywords: ["vegetable", "legume", "salad", "salade"], category: "Légume", nutritionBucket: "Légume" },
  { keywords: ["fruit"], category: "Fruit", nutritionBucket: "Fruit" },
  {
    keywords: ["cereal", "cereale", "pasta", "pate", "rice", "riz", "bread", "pain"],
    category: "Féculent",
    nutritionBucket: "Féculent",
  },
  {
    keywords: ["beverage", "boisson", "drink", "water", "eau", "juice", "jus", "soda"],
    category: "Boisson",
    nutritionBucket: "Boisson",
  },
];

function normalizeTag(tag: string): string {
  const withoutPrefix = tag.includes(":") ? tag.slice(tag.indexOf(":") + 1) : tag;
  return withoutPrefix.toLowerCase().replace(/-/g, " ");
}

function prettifyTag(tag: string): string {
  const normalized = normalizeTag(tag);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function deriveCategory(product: OffProduct): {
  category: DisplayCategory;
  subcategory: string;
  nutritionBucket: NutritionBucket;
} {
  const normalizedTags = product.categoriesTags.map(normalizeTag);
  const nameLower = (product.productName ?? "").toLowerCase();

  for (const rule of CATEGORY_RULES) {
    const matchedKeyword = rule.keywords.find(
      (keyword) => normalizedTags.some((tag) => tag.includes(keyword)) || nameLower.includes(keyword)
    );
    if (!matchedKeyword) continue;

    if (rule.fixedSubcategory) {
      return { category: rule.category, subcategory: rule.fixedSubcategory, nutritionBucket: rule.nutritionBucket };
    }

    const specificTag = [...product.categoriesTags]
      .reverse()
      .find((tag) => normalizeTag(tag).includes(matchedKeyword));

    return {
      category: rule.category,
      subcategory: specificTag ? prettifyTag(specificTag) : rule.nutritionBucket,
      nutritionBucket: rule.nutritionBucket,
    };
  }

  return { category: "Autre", subcategory: "Non classé", nutritionBucket: "Autre" };
}
