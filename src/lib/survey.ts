import { surveyQuestions, surveyTipMaxLength } from "@/config/survey";

export type SurveyAnswers = Record<string, string[]>;
export type SurveyResponse = { answers: SurveyAnswers; tip: string };

/**
 * Liest die Umfrage aus dem Formular. Unbekannte Antworten werden verworfen, bei Einfachauswahl
 * zählt nur die erste. Alles ist optional, aber komplett leer wird nicht gespeichert.
 */
export function parseSurvey(formData: FormData): SurveyResponse | null {
  const answers: SurveyAnswers = {};
  for (const question of surveyQuestions) {
    const allowed = new Set<string>(question.options.map((o) => o.id));
    const picked = [...new Set(formData.getAll(question.id).map(String))].filter((id) => allowed.has(id));
    const values = question.multiple ? picked : picked.slice(0, 1);
    if (values.length) answers[question.id] = values;
  }
  const tip = String(formData.get("tip") ?? "")
    .trim()
    .slice(0, surveyTipMaxLength);
  return Object.keys(answers).length || tip ? { answers, tip } : null;
}

/** Zählt pro Frage, wie oft jede Antwort gewählt wurde (für die Auswertung im Admin). */
export function tallySurvey(responses: Pick<SurveyResponse, "answers">[]) {
  return surveyQuestions.map((question) => {
    const counts = question.options.map((option) => ({
      ...option,
      count: responses.filter((r) => r.answers[question.id]?.includes(option.id)).length,
    }));
    const answered = responses.filter((r) => r.answers[question.id]?.length).length;
    return { id: question.id, label: question.label, answered, counts };
  });
}
