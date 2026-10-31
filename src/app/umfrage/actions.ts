"use server";

import { parseSurvey } from "@/lib/survey";
import { loadSurvey } from "@/server/integrations";
import { log } from "@/server/log";

export type SurveyState = { ok: true } | { ok: false; error: string } | null;

export async function submitSurveyAction(_prev: SurveyState, formData: FormData): Promise<SurveyState> {
  // Honeypot: Bots füllen das versteckte Feld aus, Menschen sehen es nicht.
  if (String(formData.get("website") ?? "")) return { ok: true };
  const response = parseSurvey(formData);
  if (!response)
    return {
      ok: false,
      error: "Wähl mindestens eine Antwort aus oder schreib uns einen Tipp.",
    };

  const survey = loadSurvey();
  if (!survey)
    return {
      ok: false,
      error: "Die Umfrage ist gerade nicht erreichbar. Schreib uns gern an hallo@leanchicken.de.",
    };
  try {
    const { id } = await survey.store.saveSurveyResponse(response);
    log("survey_submitted", { tip: Boolean(response.tip) });
    // Ohne Mail gehen keine Antworten verloren: sie stehen in der Auswertung im Admin.
    await survey
      .notifyTip?.(id, response)
      .catch((error: unknown) => log("survey_failed", { step: "mail", error: String(error) }));
    return { ok: true };
  } catch (error) {
    log("survey_failed", { step: "save", error: String(error) });
    return {
      ok: false,
      error: "Das hat nicht geklappt. Versuch es bitte gleich noch mal.",
    };
  }
}
