import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFridgeItems } from "./api.js";
import type { FridgeItem } from "./api.js";
import Card from "./Card.js";

interface ExpiringItem {
  item: FridgeItem;
  diffDays: number;
}

function computeExpiring(items: FridgeItem[]): ExpiringItem[] {
  const now = Date.now();
  return items
    .map((item) => ({ item, diffDays: Math.ceil((new Date(item.expiresAt).getTime() - now) / (24 * 60 * 60 * 1000)) }))
    .filter((e) => e.diffDays <= 3)
    .sort((a, b) => a.diffDays - b.diffDays);
}

function formatDays(diffDays: number): string {
  if (diffDays < 0) return "Expiré";
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  return `${diffDays} j`;
}

const MAX_SHOWN = 6;

// Widget compact accueil : ce qui périme dans le frigo, sans prendre de
// place — une seule ligne de pastilles défilable horizontalement, jamais de
// grille ni de liste détaillée (ça, c'est déjà le rôle de FridgePage triée
// par péremption). Invisible si rien n'expire bientôt.
export default function ExpiryWidget() {
  const [expiring, setExpiring] = useState<ExpiringItem[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getFridgeItems()
      .then((items) => setExpiring(computeExpiring(items)))
      .catch(() => setExpiring(null));
  }, []);

  if (!expiring || expiring.length === 0) return null;

  const shown = expiring.slice(0, MAX_SHOWN);
  const extraCount = expiring.length - shown.length;

  return (
    <Card className="expiry-widget">
      <div className="expiry-widget-header">
        <h3>⏰ À utiliser bientôt</h3>
        <button className="expiry-widget-link" onClick={() => navigate("/frigo")}>
          Voir le frigo
        </button>
      </div>
      <div className="expiry-widget-row">
        {shown.map(({ item, diffDays }) => (
          <span key={item.id} className={`expiry-widget-chip ${diffDays < 0 ? "expired" : "soon"}`}>
            {item.name} · {formatDays(diffDays)}
          </span>
        ))}
        {extraCount > 0 && <span className="expiry-widget-chip more">+{extraCount}</span>}
      </div>
    </Card>
  );
}
