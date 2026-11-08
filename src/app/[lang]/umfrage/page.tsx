import type { Metadata } from "next";
import { SurveyForm } from "@/app/[lang]/umfrage/survey-form";
import { pilot, pilotDates } from "@/config/business";
import { surveyQuestions } from "@/config/survey";
import { getDictionary, localePath, resolveLocale } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/umfrage">): Promise<Metadata> {
  const lang = await resolveLocale(params);
  const t = getDictionary(lang).meta;
  return { title: t.surveyTitle, description: t.surveyDescription(pilot.label) };
}

export default async function SurveyPage({ params }: PageProps<"/[lang]/umfrage">) {
  const lang = await resolveLocale(params);
  const dict = getDictionary(lang);
  const t = dict.survey;
  const dates = pilotDates(lang);
  // Fragen und Antworten in der Sprache der Seite; gespeichert werden weiter nur die IDs.
  const questions = surveyQuestions.map((q) => ({
    id: q.id,
    label: lang === "en" ? q.labelEn : q.label,
    multiple: q.multiple,
    options: q.options.map((o) => ({ id: o.id, label: lang === "en" ? o.labelEn : o.label })),
  }));
  return (
    <main className="wrap survey-page">
      <p className="eyebrow">{t.eyebrow(pilot.label, dates.startLabel, dates.endLabel)}</p>
      <h1>
        {t.titleBefore}
        <span className="brush">{t.titleBrush}</span>
      </h1>
      <p className="lead">{t.lead}</p>
      <SurveyForm
        lang={lang}
        questions={questions}
        labels={dict.surveyForm}
        endLabel={dates.endLabel}
        orderHref={localePath(lang, "/bestellen")}
        homeHref={localePath(lang, "/")}
      />
    </main>
  );
}
