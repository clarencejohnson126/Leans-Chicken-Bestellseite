"use server";

import { business } from "@/config/business";
import { getDictionary, isLocale } from "@/i18n";
import { parseSurvey } from "@/lib/survey";
import { loadSurvey } from "@/server/integrations";
import { log } from "@/server/log";

export type SurveyState = { ok: true } | { ok: false; error: string } | null;

export async function submitSurveyAction(_prev: SurveyState, formData: FormData): Promise<SurveyState> {
  // Honeypot: Bots füllen das versteckte Feld aus, Menschen sehen es nicht.
  if (String(formData.get("website") ?? "")) return { ok: true };
  const lang = formData.get("lang");
  const t = getDictionary(isLocale(lang) ? lang : "de").surveyErrors;
  const response = parseSurvey(formData);
  if (!response)
    return {
      ok: false,
      error: t.empty,
    };

  const survey = loadSurvey();
  if (!survey)
    return {
      ok: false,
      error: t.unavailable(business.operator.email),
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
      error: t.failed,
    };
  }
}
