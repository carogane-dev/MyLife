import { useState } from "react";
import { recognizeMealPhoto, logManualConsumption } from "./api.js";
import type { MealSlot } from "./api.js";

const SLOT_LABELS: Record<MealSlot, string> = {
  "petit-dejeuner": "🌅 Petit-déjeuner",
  dejeuner: "☀️ Déjeuner",
  diner: "🌙 Dîner",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  haute: "Confiance haute",
  moyenne: "Confiance moyenne",
  basse: "Confiance basse — vérifie et corrige si besoin",
};

function defaultSlotFromHour(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 11) return "petit-dejeuner";
  if (hour < 16) return "dejeuner";
  return "diner";
}

// Sépare le préfixe "data:image/jpeg;base64," du contenu base64 lui-même —
// l'API attend les deux séparément (imageBase64, mediaType).
function splitDataUrl(dataUrl: string): { base64: string; mediaType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

export default function AddMealPage({ onBack }: { onBack: () => void }) {
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [dishName, setDishName] = useState("");
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [fat, setFat] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [slot, setSlot] = useState<MealSlot>(defaultSlotFromHour);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaved(false);
    setError(null);
    setReason(null);
    setShowForm(false);
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!photoDataUrl) return;
    const split = splitDataUrl(photoDataUrl);
    if (!split) {
      setError("Photo illisible, réessaie.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const result = await recognizeMealPhoto(split.base64, split.mediaType);
      if (result.recognized) {
        setDishName(result.dishName ?? "");
        setCalories(result.estimatedMacros?.calories ?? 0);
        setProtein(result.estimatedMacros?.protein ?? 0);
        setFat(result.estimatedMacros?.fat ?? 0);
        setCarbs(result.estimatedMacros?.carbs ?? 0);
        setConfidence(result.confidence ?? null);
        setNotes(result.notes ?? null);
      } else {
        setReason(result.reason ?? "Reconnaissance impossible — saisis le repas manuellement ci-dessous.");
        setDishName("");
        setCalories(0);
        setProtein(0);
        setFat(0);
        setCarbs(0);
        setConfidence(null);
        setNotes(null);
      }
      setShowForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await logManualConsumption(
        { name: dishName || "Repas", quantity: 1, unit: "portion", calories, protein, fat, carbs },
        slot
      );
      setSaved(true);
      setShowForm(false);
      setPhotoDataUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPhotoDataUrl(null);
    setShowForm(false);
    setSaved(false);
    setReason(null);
    setConfidence(null);
    setNotes(null);
  }

  return (
    <div className="add-meal-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>📷 Ajouter un repas</h2>
      <p className="wizard-hint">
        Prends une photo de ton assiette : l'IA propose un nom de plat et une estimation des macros, toujours
        modifiable avant de journaliser.
      </p>

      {saved && (
        <p className="settings-saved-note">
          Repas enregistré, bon appétit ! 🎉{" "}
          <button className="week-plan-mini-regen" onClick={reset}>
            Ajouter un autre repas
          </button>
        </p>
      )}

      {!saved && (
        <>
          {!photoDataUrl && (
            <label className="auth-submit add-meal-photo-input">
              📷 Prendre / choisir une photo
              <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} hidden />
            </label>
          )}

          {photoDataUrl && (
            <div className="add-meal-preview">
              <img src={photoDataUrl} alt="Photo du repas" className="add-meal-photo-preview" />
              {!showForm && (
                <div className="scan-actions">
                  <button className="auth-submit" onClick={handleAnalyze} disabled={analyzing}>
                    {analyzing ? "🔍 L'IA regarde ton assiette…" : "🔍 Analyser la photo"}
                  </button>
                  <button className="logout-button" onClick={reset} disabled={analyzing}>
                    Changer de photo
                  </button>
                </div>
              )}
            </div>
          )}

          {error && <p className="fridge-error">{error}</p>}
          {reason && <p className="fridge-empty">{reason}</p>}
          {confidence && <p className="scan-hint">{CONFIDENCE_LABELS[confidence] ?? confidence}</p>}
          {notes && <p className="scan-hint">{notes}</p>}

          {showForm && (
            <>
              <div className="meal-slot-tabs">
                {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
                  <button key={s} className={slot === s ? "active" : ""} onClick={() => setSlot(s)}>
                    {SLOT_LABELS[s]}
                  </button>
                ))}
              </div>

              <div className="auth-form">
                <label>
                  Nom du plat
                  <input type="text" value={dishName} onChange={(e) => setDishName(e.target.value)} placeholder="ex. Salade César" />
                </label>
                <label>
                  Calories (kcal)
                  <input type="number" min="0" step="any" value={calories} onChange={(e) => setCalories(Number(e.target.value))} />
                </label>
                <label>
                  Protéines (g)
                  <input type="number" min="0" step="any" value={protein} onChange={(e) => setProtein(Number(e.target.value))} />
                </label>
                <label>
                  Lipides (g)
                  <input type="number" min="0" step="any" value={fat} onChange={(e) => setFat(Number(e.target.value))} />
                </label>
                <label>
                  Glucides (g)
                  <input type="number" min="0" step="any" value={carbs} onChange={(e) => setCarbs(Number(e.target.value))} />
                </label>
              </div>

              <div className="scan-actions">
                <button className="auth-submit" onClick={handleSave} disabled={saving || !dishName.trim()}>
                  {saving ? "Enregistrement…" : "✅ Manger ce repas"}
                </button>
                <button className="logout-button" onClick={reset} disabled={saving}>
                  Annuler
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
