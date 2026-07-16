// Convertit une quantité exprimée dans l'unité d'un FridgeItem en grammes,
// pour appliquer les macros (toujours "pour 100g") quelle que soit l'unité
// affichée. "pièce" (ou toute unité non standard) n'a pas de poids fixe
// connu : on utilise le poids unitaire fourni par l'utilisateur, avec un
// repli à 100g s'il n'a jamais été renseigné.
export function unitToGramsFactor(unit: string, unitWeightGrams: number | null): number {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "g") return 1;
  if (normalized === "kg") return 1000;
  if (normalized === "l") return 1000; // approximation : densité proche de l'eau
  return unitWeightGrams ?? 100;
}

export function quantityToGrams(quantity: number, unit: string, unitWeightGrams: number | null): number {
  return quantity * unitToGramsFactor(unit, unitWeightGrams);
}
