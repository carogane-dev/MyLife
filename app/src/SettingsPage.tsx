import { useEffect, useState } from "react";
import { getProfile, saveProfile } from "./api.js";
import type { NutritionProfileDraft } from "./api.js";
import SliderInput from "./SliderInput.js";
import ChoiceCards from "./ChoiceCards.js";

const SEX_OPTIONS = [
  { value: "homme", label: "Homme" },
  { value: "femme", label: "Femme" },
  { value: "autre", label: "Autre" },
];

const ACTIVITY_OPTIONS = [
  { value: "sedentaire", label: "Sédentaire", description: "Peu ou pas d'exercice" },
  { value: "leger", label: "Légèrement actif", description: "Exercice léger 1 à 3 jours/semaine" },
  { value: "modere", label: "Modérément actif", description: "Exercice modéré 3 à 5 jours/semaine" },
  { value: "actif", label: "Actif", description: "Exercice intense 6 à 7 jours/semaine" },
  { value: "tres_actif", label: "Très actif", description: "Exercice très intense ou travail physique" },
];

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const [draft, setDraft] = useState<NutritionProfileDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (profile) {
          setDraft({
            sex: profile.sex,
            age: profile.age,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            activityLevel: profile.activityLevel,
          });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  function update(patch: Partial<NutritionProfileDraft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setSaved(false);
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile(draft);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <button className="page-back" onClick={onBack}>
        ← Retour
      </button>
      <h2>⚙️ Paramètres</h2>

      {loading && <p>Chargement…</p>}
      {error && <p className="fridge-error">{error}</p>}

      {draft && (
        <div className="settings-form">
          <div>
            <h3>Sexe</h3>
            <ChoiceCards options={SEX_OPTIONS} value={draft.sex} onChange={(v) => update({ sex: v as NutritionProfileDraft["sex"] })} />
          </div>

          <SliderInput label="Âge" value={draft.age} min={13} max={100} unit=" ans" onChange={(v) => update({ age: v })} />
          <SliderInput label="Taille" value={draft.heightCm} min={120} max={220} unit=" cm" onChange={(v) => update({ heightCm: v })} />
          <SliderInput label="Poids" value={draft.weightKg} min={30} max={200} step={0.5} unit=" kg" onChange={(v) => update({ weightKg: v })} />

          <div>
            <h3>Niveau d'activité</h3>
            <ChoiceCards
              options={ACTIVITY_OPTIONS}
              value={draft.activityLevel}
              onChange={(v) => update({ activityLevel: v as NutritionProfileDraft["activityLevel"] })}
              stacked
            />
          </div>

          {saved && <p className="settings-saved-note">Profil mis à jour ✅</p>}

          <button className="auth-submit" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}
    </div>
  );
}
