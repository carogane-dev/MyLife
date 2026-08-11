// Appel direct à l'API Anthropic (Messages, avec un bloc image) sans SDK —
// même esprit que offClient.ts (appel HTTP externe brut pour OpenFoodFacts).
// Nécessite ANTHROPIC_API_KEY dans l'environnement (voir routes/meals.ts
// pour la dégradation propre si absente) ; l'utilisateur crée et fournit
// cette clé lui-même.

const VISION_TIMEOUT_MS = 20000;
const VISION_MODEL = "claude-sonnet-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class VisionRecognitionError extends Error {}

export interface DishRecognition {
  dishName: string;
  confidence: "haute" | "moyenne" | "basse";
  caloriesPerServing: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  notes: string;
  rawResponseText: string;
}

const PROMPT = `Tu analyses une photo d'un plat pour une application de suivi nutritionnel. Identifie le plat et estime ses valeurs nutritionnelles pour UNE portion telle que visible sur la photo.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni bloc de code, au format exact suivant :
{"dishName": string, "confidence": "haute" | "moyenne" | "basse", "caloriesPerServing": number, "proteinG": number, "fatG": number, "carbsG": number, "notes": string}

"confidence" reflète ta certitude sur l'identification du plat (pas sur la précision des macros, qui restent toujours approximatives sur une simple photo). "notes" est une phrase courte en français expliquant ton estimation ou signalant une ambiguïté (ex. ingrédients cachés par une sauce). Si tu ne parviens vraiment pas à identifier de plat alimentaire sur la photo, renvoie "dishName": "" et "confidence": "basse".`;

// Certains modèles enrobent parfois leur JSON dans un bloc ```json — on le
// retire avant de parser plutôt que de compter sur un format strict.
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

export async function recognizeDish(imageBase64: string, mediaType: string): Promise<DishRecognition> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new VisionRecognitionError("ANTHROPIC_API_KEY absente de l'environnement.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new VisionRecognitionError("Impossible de contacter l'API de reconnaissance vision.");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new VisionRecognitionError(`L'API vision a répondu ${res.status}: ${body.slice(0, 200)}`);
  }

  const body = await res.json();
  const rawResponseText: string = body?.content?.[0]?.text ?? "";
  if (!rawResponseText) {
    throw new VisionRecognitionError("Réponse vide de l'API vision.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(rawResponseText));
  } catch {
    throw new VisionRecognitionError("Réponse de l'API vision non interprétable (JSON invalide).");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new VisionRecognitionError("Réponse de l'API vision au format inattendu.");
  }
  const p = parsed as Record<string, unknown>;
  const confidence = p.confidence === "haute" || p.confidence === "moyenne" || p.confidence === "basse" ? p.confidence : "basse";
  const toNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  return {
    dishName: typeof p.dishName === "string" ? p.dishName : "",
    confidence,
    caloriesPerServing: toNumber(p.caloriesPerServing),
    proteinG: toNumber(p.proteinG),
    fatG: toNumber(p.fatG),
    carbsG: toNumber(p.carbsG),
    notes: typeof p.notes === "string" ? p.notes : "",
    rawResponseText,
  };
}
