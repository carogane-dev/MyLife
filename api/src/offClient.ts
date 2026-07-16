const OFF_TIMEOUT_MS = 5000;

export interface OffProduct {
  productName: string | null;
  quantityGrams: number | null;
  categoriesTags: string[];
  nutriments: {
    caloriesPer100g: number | null;
    proteinPer100g: number | null;
    fatPer100g: number | null;
    carbsPer100g: number | null;
  };
}

export class OffLookupError extends Error {}

function parseQuantityGrams(quantity: unknown): number | null {
  if (typeof quantity !== "string") return null;
  const match = quantity.match(/([\d.,]+)\s*(kg|g)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return match[2].toLowerCase() === "kg" ? value * 1000 : value;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function fetchOffProduct(barcode: string): Promise<OffProduct | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      headers: { "User-Agent": "MonApp - app perso de suivi alimentaire (contact via GitHub)" },
      signal: controller.signal,
    });
  } catch (err) {
    throw new OffLookupError("Impossible de contacter Open Food Facts");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new OffLookupError(`Open Food Facts a répondu ${res.status}`);
  }

  const body = await res.json();
  if (body.status !== 1 || !body.product) {
    return null;
  }

  const product = body.product;
  const nutriments = product.nutriments ?? {};

  return {
    productName: product.product_name_fr || product.product_name || null,
    quantityGrams: toFiniteNumber(product.product_quantity) ?? parseQuantityGrams(product.quantity),
    categoriesTags: Array.isArray(product.categories_tags) ? product.categories_tags : [],
    nutriments: {
      caloriesPer100g: toFiniteNumber(nutriments["energy-kcal_100g"]),
      proteinPer100g: toFiniteNumber(nutriments["proteins_100g"]),
      fatPer100g: toFiniteNumber(nutriments["fat_100g"]),
      carbsPer100g: toFiniteNumber(nutriments["carbohydrates_100g"]),
    },
  };
}
