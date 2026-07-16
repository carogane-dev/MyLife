import { useState } from "react";
import { saveProfile } from "./api.js";
import type { NutritionProfile, NutritionProfileDraft } from "./api.js";
import SliderInput from "./SliderInput.js";
import ChoiceCards from "./ChoiceCards.js";
import NutritionTargetsSummary, { GOAL_MODE_OPTIONS, getBodyTypeOptions } from "./NutritionTargetsSummary.js";
import { calculateNutritionTargets } from "./nutritionCalculator.js";

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

const TOTAL_STEPS = 6;

export default function OnboardingPage({ onComplete }: { onComplete: (profile: NutritionProfile) => void }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<NutritionProfileDraft>({
    sex: "homme",
    age: 30,
    heightCm: 170,
    weightKg: 70,
    activityLevel: "modere",
    goalMode: "ligne",
    bodyType: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<NutritionProfileDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const profile = await saveProfile(draft);
      onComplete(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="auth-card">
        {step <= TOTAL_STEPS && (
          <div className="wizard-progress">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span key={i} className={`dot ${i + 1 <= step ? "active" : ""}`} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="wizard-step">
            <h3>Tu es...</h3>
            <p className="wizard-hint">Utilisé uniquement pour la formule de calcul des besoins caloriques.</p>
            <ChoiceCards options={SEX_OPTIONS} value={draft.sex} onChange={(v) => update({ sex: v as NutritionProfileDraft["sex"] })} />
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <h3>Ton âge</h3>
            <SliderInput label="Âge" value={draft.age} min={13} max={100} unit=" ans" onChange={(v) => update({ age: v })} />
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step">
            <h3>Ta taille</h3>
            <SliderInput label="Taille" value={draft.heightCm} min={120} max={220} unit=" cm" onChange={(v) => update({ heightCm: v })} />
          </div>
        )}

        {step === 4 && (
          <div className="wizard-step">
            <h3>Ton poids</h3>
            <SliderInput label="Poids" value={draft.weightKg} min={30} max={200} step={0.5} unit=" kg" onChange={(v) => update({ weightKg: v })} />
          </div>
        )}

        {step === 5 && (
          <div className="wizard-step">
            <h3>Ton niveau d'activité</h3>
            <ChoiceCards
              options={ACTIVITY_OPTIONS}
              value={draft.activityLevel}
              onChange={(v) => update({ activityLevel: v as NutritionProfileDraft["activityLevel"] })}
              stacked
            />
          </div>
        )}

        {step === 6 && (
          <div className="wizard-step">
            <h3>Ton objectif</h3>
            <p className="wizard-hint">Choisis ton niveau de difficulté — tu pourras le changer plus tard.</p>
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
        )}

        {step === 7 && (
          <div className="wizard-step">
            <h3>Vérifie tes infos</h3>
            <ul className="wizard-summary">
              <li onClick={() => setStep(1)}>
                <span>Sexe</span>
                <span>{SEX_OPTIONS.find((o) => o.value === draft.sex)?.label}</span>
              </li>
              <li onClick={() => setStep(2)}>
                <span>Âge</span>
                <span>{draft.age} ans</span>
              </li>
              <li onClick={() => setStep(3)}>
                <span>Taille</span>
                <span>{draft.heightCm} cm</span>
              </li>
              <li onClick={() => setStep(4)}>
                <span>Poids</span>
                <span>{draft.weightKg} kg</span>
              </li>
              <li onClick={() => setStep(5)}>
                <span>Activité</span>
                <span>{ACTIVITY_OPTIONS.find((o) => o.value === draft.activityLevel)?.label}</span>
              </li>
              <li onClick={() => setStep(6)}>
                <span>Objectif</span>
                <span>{GOAL_MODE_OPTIONS.find((o) => o.value === draft.goalMode)?.label}</span>
              </li>
              {draft.goalMode === "elite" && (
                <li onClick={() => setStep(6)}>
                  <span>Morphologie</span>
                  <span>{getBodyTypeOptions(draft.sex).find((o) => o.value === draft.bodyType)?.label ?? "—"}</span>
                </li>
              )}
            </ul>

            <NutritionTargetsSummary
              goalMode={draft.goalMode}
              bodyType={draft.bodyType}
              sex={draft.sex}
              targets={calculateNutritionTargets(draft)}
              activityLevel={draft.activityLevel}
            />

            {error && <p className="auth-error">{error}</p>}
            <div className="wizard-nav">
              <button className="page-back" onClick={() => setStep(6)} disabled={saving}>
                ← Retour
              </button>
              <button className="auth-submit" onClick={handleConfirm} disabled={saving}>
                {saving ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        )}

        {step < 7 && (
          <div className="wizard-nav">
            <button className="page-back" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
              ← Retour
            </button>
            <button className="auth-submit" onClick={() => setStep((s) => s + 1)}>
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
