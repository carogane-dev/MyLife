import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { createFridgeItem, lookupBarcode } from "./api.js";
import type { FridgeItemDraft } from "./api.js";

type Phase = "scanning" | "looking-up" | "confirm" | "saving" | "camera-error";

const SCANNER_ELEMENT_ID = "barcode-scanner-viewport";

export default function ScanPage({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("scanning");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FridgeItemDraft | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lockRef = useRef(false);

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

  function updateDraft(patch: Partial<FridgeItemDraft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  return (
    <div className="scan-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>🏷️ Scanner</h2>
      {addedCount > 0 && <p className="scan-session-count">{addedCount} article(s) ajouté(s) cette session.</p>}

      <div id={SCANNER_ELEMENT_ID} className="scan-viewport" />

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
            <button className="auth-submit" onClick={handleAdd} disabled={phase === "saving"}>
              {phase === "saving" ? "Ajout…" : "Ajouter au frigo"}
            </button>
            <button className="logout-button" onClick={resumeScanning} disabled={phase === "saving"}>
              Annuler / rescanner
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
