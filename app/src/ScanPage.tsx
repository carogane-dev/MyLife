import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { createFridgeItem, getWeekPlan, lookupBarcode } from "./api.js";
import type { FridgeItemDraft } from "./api.js";
import { isGramsBasedUnit } from "./unitConversion.js";
import { useToast } from "./ToastProvider.js";

type Phase = "scanning" | "looking-up" | "confirm" | "saving" | "camera-error";

const SCANNER_ELEMENT_ID = "barcode-scanner-viewport";

interface CartItem {
  id: number;
  draft: FridgeItemDraft;
  matched: boolean;
}

// Correspondance volontairement simple (accents/casse ignorés, sous-chaîne
// dans les deux sens) — sert uniquement à teinter visuellement un article
// scanné pendant la session ("déjà sur la liste" vs "ajouté en plus"), pas
// à faire foi pour la liste de courses elle-même (qui reste calculée
// côté serveur à partir du stock réel, voir weekPlanner.ts).
function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na.length > 0 && nb.length > 0 && (na.includes(nb) || nb.includes(na));
}

export default function ScanPage({ onBack }: { onBack: () => void }) {
  const [searchParams] = useSearchParams();
  const cartMode = searchParams.get("mode") === "shopping";
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<Phase>("scanning");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FridgeItemDraft | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [shoppingNames, setShoppingNames] = useState<string[]>([]);
  const [committing, setCommitting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lockRef = useRef(false);
  const cartIdRef = useRef(0);

  useEffect(() => {
    if (!cartMode) return;
    getWeekPlan()
      .then((result) => setShoppingNames(result.weekPlan?.shoppingList.map((i) => i.name) ?? []))
      .catch(() => setShoppingNames([]));
  }, [cartMode]);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;
    let cancelled = false;
    let started = false;

    function fail() {
      if (cancelled) return;
      setPhase("camera-error");
      setError("Impossible d'accéder à la caméra. Vérifie les autorisations.");
    }

    Promise.resolve()
      .then(() =>
        scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => handleDecoded(decodedText),
          () => {
            // erreurs de décodage image par image, ignorées (bruit normal)
          }
        )
      )
      .then(() => {
        started = true;
        // Le composant a été démonté (ex. double montage de StrictMode)
        // pendant que la caméra démarrait : on arrête immédiatement.
        if (cancelled) {
          scanner.stop().catch(() => {}).finally(() => scanner.clear());
        }
      })
      .catch(fail);

    return () => {
      cancelled = true;
      if (started) {
        scanner.stop().catch(() => {}).finally(() => scanner.clear());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDecoded(barcode: string) {
    if (lockRef.current) return;
    lockRef.current = true;

    await scannerRef.current?.pause(true);
    setPhase("looking-up");
    setError(null);

    try {
      const item = await lookupBarcode(barcode);
      setDraft(item);
      setPhase("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPhase("confirm");
      setDraft(null);
    } finally {
      lockRef.current = false;
    }
  }

  function resumeScanning() {
    setDraft(null);
    setError(null);
    setPhase("scanning");
    scannerRef.current?.resume();
  }

  async function handleAdd() {
    if (!draft) return;

    if (cartMode) {
      const matched = shoppingNames.some((n) => namesMatch(n, draft.name));
      cartIdRef.current += 1;
      setCart((c) => [...c, { id: cartIdRef.current, draft, matched }]);
      resumeScanning();
      return;
    }

    setPhase("saving");
    try {
      await createFridgeItem(draft);
      setAddedCount((n) => n + 1);
      resumeScanning();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPhase("confirm");
    }
  }

  function removeFromCart(id: number) {
    setCart((c) => c.filter((item) => item.id !== id));
  }

  // Écrit le panier scanné dans le frigo d'un coup, seulement au clic sur
  // "Ajouter au frigo" — jamais au fil du scan, contrairement au scan
  // rapide de l'accueil (mode instantané, inchangé ci-dessus). Les articles
  // en échec restent dans le panier pour un nouvel essai plutôt que d'être
  // perdus silencieusement.
  async function commitCart() {
    setCommitting(true);
    const failures: CartItem[] = [];
    for (const item of cart) {
      try {
        await createFridgeItem(item.draft);
      } catch {
        failures.push(item);
      }
    }
    setCart(failures);
    setCommitting(false);
    if (failures.length === 0) {
      showToast(`${cart.length} article(s) ajouté(s) au frigo.`, "info");
      navigate("/courses");
    } else {
      showToast(`${failures.length} article(s) n'ont pas pu être ajoutés, réessaie.`);
    }
  }

  function updateDraft(patch: Partial<FridgeItemDraft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  return (
    <div className="scan-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>{cartMode ? "🛒 Scanner mes courses" : "🏷️ Scanner"}</h2>
      {cartMode ? (
        <p className="wizard-hint">
          Scanne ce que tu ramènes — rien n'est ajouté au frigo tant que tu n'as pas confirmé en bas.
        </p>
      ) : (
        addedCount > 0 && <p className="scan-session-count">{addedCount} article(s) ajouté(s) cette session.</p>
      )}

      <div id={SCANNER_ELEMENT_ID} className="scan-viewport" />

      {cartMode && cart.length > 0 && (
        <ul className="scan-cart">
          {cart.map((item) => (
            <li key={item.id} className={`scan-cart-item ${item.matched ? "matched" : "unmatched"}`}>
              <span className="scan-cart-item-name">{item.draft.name}</span>
              <span className="scan-cart-item-tag">{item.matched ? "sur la liste" : "pas prévu"}</span>
              <button className="scan-cart-item-remove" onClick={() => removeFromCart(item.id)} aria-label="Retirer">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {phase === "scanning" && <p className="scan-status">Vise le code-barres avec la caméra.</p>}
      {phase === "looking-up" && <p className="scan-status">Recherche du produit…</p>}

      {phase === "camera-error" && <p className="fridge-error">{error}</p>}

      {phase === "confirm" && error && !draft && (
        <div className="scan-confirm-card">
          <p className="fridge-error">{error}</p>
          <div className="scan-actions">
            <button className="auth-submit" onClick={resumeScanning}>
              Réessayer
            </button>
          </div>
        </div>
      )}

      {(phase === "confirm" || phase === "saving") && draft && (
        <div className="scan-confirm-card">
          <h3>{draft.name}</h3>
          <p className="scan-status">
            {draft.category} · {draft.subcategory}
          </p>

          <div className="auth-form">
            <label>
              Quantité
              <input
                type="number"
                min="0"
                step="any"
                value={draft.quantity}
                onChange={(e) => updateDraft({ quantity: Number(e.target.value) })}
              />
            </label>
            <label>
              Unité
              <input type="text" value={draft.unit} onChange={(e) => updateDraft({ unit: e.target.value })} />
            </label>
            {!isGramsBasedUnit(draft.unit) && (
              <label>
                Poids d'une {draft.unit || "unité"} (g)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={draft.unitWeightGrams ?? ""}
                  placeholder="ex. 60"
                  onChange={(e) => updateDraft({ unitWeightGrams: e.target.value ? Number(e.target.value) : null })}
                />
              </label>
            )}
            {!isGramsBasedUnit(draft.unit) && (
              <p className="scan-hint">
                Utilisé pour calculer les calories quand tu manges une partie de la quantité (repli à 100g si laissé vide).
              </p>
            )}
            <label>
              Date de péremption
              <input
                type="date"
                value={draft.expiresAt ?? ""}
                onChange={(e) => updateDraft({ expiresAt: e.target.value || null })}
                required
              />
            </label>
            <p className="scan-hint">Renseigne la date indiquée sur l'emballage (non fournie par le scan).</p>
          </div>

          <div className="scan-nutrition-preview">
            <div>
              <strong>{draft.caloriesPer100g}</strong> kcal
            </div>
            <div>
              <strong>{draft.proteinPer100g}</strong> g protéines
            </div>
            <div>
              <strong>{draft.fatPer100g}</strong> g lipides
            </div>
            <div>
              <strong>{draft.carbsPer100g}</strong> g glucides
            </div>
          </div>
          {draft.nutritionEstimated && <span className="fridge-item-estimated-badge">Estimé</span>}

          {error && <p className="fridge-error">{error}</p>}

          <div className="scan-actions">
            <button className="auth-submit" onClick={handleAdd} disabled={phase === "saving" || !draft.expiresAt}>
              {phase === "saving" ? "Ajout…" : cartMode ? "Ajouter au panier" : "Ajouter au frigo"}
            </button>
            <button className="logout-button" onClick={resumeScanning} disabled={phase === "saving"}>
              Annuler / rescanner
            </button>
          </div>
        </div>
      )}

      {cartMode && cart.length > 0 && (
        <div className="scan-cart-bar">
          <button className="auth-submit" onClick={commitCart} disabled={committing}>
            {committing ? "Ajout…" : `🧊 Ajouter au frigo (${cart.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
