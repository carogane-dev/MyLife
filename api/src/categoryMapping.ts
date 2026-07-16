import type { CategoryBucket } from "./nutritionDefaults.js";
import type { OffProduct } from "./offClient.js";

// Ordre de priorité volontaire : résout les ambiguïtés (ex. "saucisse au
// fromage" doit matcher Viande avant Fromage n'a pas d'impact ici, mais un
// produit laitier sucré ne doit pas être pris pour un fromage).
const CATEGORY_KEYWORDS: Array<{ bucket: CategoryBucket; keywords: string[] }> = [
  { bucket: "Fromage", keywords: ["cheese", "fromage"] },
  {
    bucket: "Viande",
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
  },
  { bucket: "Poisson", keywords: ["fish", "poisson", "seafood", "fruits-de-mer", "salmon", "saumon", "tuna", "thon"] },
  {
    bucket: "Produit laitier",
    keywords: ["dairies", "dairy", "produits-laitiers", "milk", "lait", "yaourt", "yogurt", "cream", "creme", "butter", "beurre", "egg", "oeuf"],
  },
  { bucket: "Légume", keywords: ["vegetable", "legume", "salad", "salade"] },
  { bucket: "Fruit", keywords: ["fruit"] },
  { bucket: "Féculent", keywords: ["cereal", "cereale", "pasta", "pate", "rice", "riz", "bread", "pain"] },
  { bucket: "Boisson", keywords: ["beverage", "boisson", "drink", "water", "eau", "juice", "jus", "soda"] },
];

function normalizeTag(tag: string): string {
  const withoutPrefix = tag.includes(":") ? tag.slice(tag.indexOf(":") + 1) : tag;
  return withoutPrefix.toLowerCase().replace(/-/g, " ");
}

function prettifyTag(tag: string): string {
  const normalized = normalizeTag(tag);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function deriveCategory(product: OffProduct): { category: CategoryBucket; subcategory: string } {
  const normalizedTags = product.categoriesTags.map(normalizeTag);
  const nameLower = (product.productName ?? "").toLowerCase();

  for (const { bucket, keywords } of CATEGORY_KEYWORDS) {
    const matchedKeyword = keywords.find(
      (keyword) => normalizedTags.some((tag) => tag.includes(keyword)) || nameLower.includes(keyword)
    );
    if (!matchedKeyword) continue;

    if (matchedKeyword === "egg" || matchedKeyword === "oeuf") {
      return { category: bucket, subcategory: "Œufs" };
    }

    const specificTag = [...product.categoriesTags]
      .reverse()
      .find((tag) => normalizeTag(tag).includes(matchedKeyword));

    return {
      category: bucket,
      subcategory: specificTag ? prettifyTag(specificTag) : bucket,
    };
  }

  return { category: "Autre", subcategory: "Non classé" };
}
