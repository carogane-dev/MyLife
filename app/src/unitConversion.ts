// Miroir de api/src/unitConversion.ts — mêmes règles de conversion, pour
// prévisualiser côté client sans aller-retour réseau.
export function isGramsBasedUnit(unit: string): boolean {
  const normalized = unit.trim().toLowerCase();
  return normalized === "g" || normalized === "kg" || normalized === "l";
}

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
