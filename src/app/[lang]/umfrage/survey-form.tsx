"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitSurveyAction } from "@/app/[lang]/umfrage/actions";
import { surveyTipMaxLength } from "@/config/survey";
import type { Dictionary } from "@/i18n/de";
import { fill, type Locale } from "@/i18n/config";

type Question = {
  id: string;
  label: string;
  multiple: boolean;
  options: { id: string; label: string }[];
};

export function SurveyForm({
  lang,
  questions,
  labels: t,
  endLabel,
  orderHref,
  homeHref,
}: {
  lang: Locale;
  questions: Question[];
  labels: Dictionary["surveyForm"];
  endLabel: string;
  orderHref: string;
  homeHref: string;
}) {
  const [state, action, pending] = useActionState(submitSurveyAction, null);

  if (state?.ok) {
    return (
      <div className="survey-done" role="status">
        <h2>{t.doneTitle}</h2>
        <p className="lead">{fill(t.doneText, { end: endLabel })}</p>
        <div className="hero-actions">
          <Link href={orderHref} className="btn btn-red">
            {t.orderNow}
          </Link>
          <Link href={homeHref} className="btn btn-ghost">
            {t.backHome}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="survey">
      {/* Sprache für die Fehlermeldungen der Server Action */}
      <input type="hidden" name="lang" value={lang} />
      {questions.map((question, i) => (
        <fieldset key={question.id} className="survey-question">
          <legend>
            <span className="survey-step">{i + 1}</span>
            {question.label}
            {question.multiple && <small> {t.multiple}</small>}
          </legend>
          <div className="survey-options">
            {question.options.map((option) => (
              <label key={option.id} className="survey-option">
                <input type={question.multiple ? "checkbox" : "radio"} name={question.id} value={option.id} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset className="survey-question">
        <legend>
          <span className="survey-step">{questions.length + 1}</span>
          {t.tipLegend} <small>{t.optional}</small>
        </legend>
        <div className="field">
          <textarea name="tip" maxLength={surveyTipMaxLength} aria-label={t.tipLabel} placeholder={t.tipPlaceholder} />
        </div>
      </fieldset>
      {/* Honeypot gegen Bots, für Menschen unsichtbar */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="survey-trap" aria-hidden="true" />
      {state && !state.ok && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-red" disabled={pending}>
        {pending ? t.sending : t.submit}
      </button>
      <p className="hint">{t.anonymous}</p>
    </form>
  );
}
