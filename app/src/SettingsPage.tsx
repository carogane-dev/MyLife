import { useEffect, useState } from "react";
import { getProfile, saveProfile } from "./api.js";
import type { NutritionProfileDraft, NutritionTargets } from "./api.js";
import SliderInput from "./SliderInput.js";
import ChoiceCards from "./ChoiceCards.js";
import NutritionTargetsSummary, { GOAL_MODE_OPTIONS, getBodyTypeOptions } from "./NutritionTargetsSummary.js";
import { calculateNutritionTargets } from "./nutritionCalculator.js";
import { useNutritionConfig } from "./useNutritionConfig.js";

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
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { modeConfigs } = useNutritionConfig();

  useEffect(() => {
    getProfile()
      .then(({ profile, targets }) => {
        if (profile) {
          setDraft({
            sex: profile.sex,
            age: profile.age,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            activityLevel: profile.activityLevel,
            goalMode: profile.goalMode,
            bodyType: profile.bodyType,
          });
          setTargets(targets);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  function update(patch: Partial<NutritionProfileDraft>) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      setTargets(calculateNutritionTargets(next, modeConfigs));
      return next;
    });
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

          <div>
            <h3>Objectif</h3>
            <ChoiceCards
              options={GOAL_MODE_OPTIONS}
              value={draft.goalMode}
              onChange={(v) =>
                update({
                  goalMode: v as NutritionProfileDraft["goalMode"],
                  bodyType: v === "elite" ? draft.bodyType : null,
                })
              }
              stacked
            />
            {draft.goalMode === "elite" && (
              <div className="body-type-picker">
                <p className="wizard-hint">Choisis la morphologie visée.</p>
                <ChoiceCards
                  options={getBodyTypeOptions(draft.sex)}
                  value={draft.bodyType ?? ""}
                  onChange={(v) => update({ bodyType: v as NutritionProfileDraft["bodyType"] })}
                  stacked
                />
              </div>
            )}
          </div>

          <NutritionTargetsSummary
            goalMode={draft.goalMode}
            bodyType={draft.bodyType}
            sex={draft.sex}
            targets={targets}
            activityLevel={draft.activityLevel}
          />

          {saved && <p className="settings-saved-note">Profil mis à jour ✅</p>}

          <button className="auth-submit" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}
    </div>
  );
}
