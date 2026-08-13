import { Beef, Fish, Milk, Carrot, Apple, Wheat, CupSoda, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Pastille icône colorée par catégorie de frigo — remplaçant temporaire
// pour une vraie photo de l'article (aucun champ image en base
// aujourd'hui). À remplacer par de vraies photos plus tard sans changer
// l'appelant : la prop reste `category`.
const CATEGORY_STYLE: Record<string, { icon: LucideIcon; bg: string; text: string }> = {
  Viande: { icon: Beef, bg: "var(--tint-coral-bg)", text: "var(--tint-coral-text)" },
  Poisson: { icon: Fish, bg: "var(--tint-blue-bg)", text: "var(--tint-blue-text)" },
  "Produit laitier": { icon: Milk, bg: "var(--tint-blue-bg)", text: "var(--tint-blue-text)" },
  Légume: { icon: Carrot, bg: "var(--tint-green-bg)", text: "var(--tint-green-text)" },
  Fruit: { icon: Apple, bg: "var(--tint-coral-bg)", text: "var(--tint-coral-text)" },
  Féculent: { icon: Wheat, bg: "var(--tint-amber-bg)", text: "var(--tint-amber-text)" },
  Boisson: { icon: CupSoda, bg: "var(--tint-blue-bg)", text: "var(--tint-blue-text)" },
  Autre: { icon: UtensilsCrossed, bg: "var(--tint-green-bg)", text: "var(--tint-green-text)" },
};

export default function CategoryIconTile({ category, size = 44 }: { category: string; size?: number }) {
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.Autre;
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
