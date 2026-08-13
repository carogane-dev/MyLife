import { Soup, Salad, Sandwich, Pizza, IceCreamBowl, Beef } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Pastille icône colorée pour un plat/recette — remplaçant temporaire pour
// une vraie photo (aucune image stockée pour les recettes aujourd'hui).
// Choisie par hash déterministe du nom : le même plat garde toujours la
// même pastille, sans dépendre d'une catégorie qui n'existe pas sur
// `Recipe`. À remplacer par de vraies photos plus tard sans changer
// l'appelant : la prop reste `name`.
const STYLES: { icon: LucideIcon; bg: string; text: string }[] = [
  { icon: Soup, bg: "var(--tint-amber-bg)", text: "var(--tint-amber-text)" },
  { icon: Salad, bg: "var(--tint-green-bg)", text: "var(--tint-green-text)" },
  { icon: Sandwich, bg: "var(--tint-coral-bg)", text: "var(--tint-coral-text)" },
  { icon: Pizza, bg: "var(--tint-amber-bg)", text: "var(--tint-amber-text)" },
  { icon: IceCreamBowl, bg: "var(--tint-blue-bg)", text: "var(--tint-blue-text)" },
  { icon: Beef, bg: "var(--tint-coral-bg)", text: "var(--tint-coral-text)" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export default function DishIconTile({ name, size = 44 }: { name: string; size?: number }) {
  const style = STYLES[hashString(name) % STYLES.length];
  const Icon = style.icon;
  return (
    <div
      className="category-icon-tile"
      style={{ width: size, height: size, background: style.bg, color: style.text }}
    >
      <Icon size={Math.round(size * 0.5)} />
    </div>
  );
}
