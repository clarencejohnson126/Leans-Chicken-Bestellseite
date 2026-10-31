"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitSurveyAction } from "@/app/umfrage/actions";
import { pilot } from "@/config/business";
import { surveyQuestions, surveyTipMaxLength } from "@/config/survey";

export function SurveyForm() {
  const [state, action, pending] = useActionState(submitSurveyAction, null);

  if (state?.ok) {
    return (
      <div className="survey-done" role="status">
        <h2>Danke, deine Stimme zählt!</h2>
        <p className="lead">
          Wir werten alles nach dem Testlauf am {pilot.endLabel} aus und entscheiden dann, an welchen Tagen es
          weitergeht.
        </p>
        <div className="hero-actions">
          <Link href="/bestellen" className="btn btn-red">
            Jetzt vorbestellen →
          </Link>
          <Link href="/" className="btn btn-ghost">
            Zur Startseite
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="survey">
      {surveyQuestions.map((question, i) => (
        <fieldset key={question.id} className="survey-question">
          <legend>
            <span className="survey-step">{i + 1}</span>
            {question.label}
            {question.multiple && <small> Mehrfachauswahl</small>}
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
          <span className="survey-step">{surveyQuestions.length + 1}</span>
          Noch ein Tipp für uns? <small>optional</small>
        </legend>
        <div className="field">
          <textarea
            name="tip"
            maxLength={surveyTipMaxLength}
            aria-label="Dein Tipp"
            placeholder="Neue Sauce, anderes Menü, Lieferung ins Büro … alles hilft."
          />
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
        {pending ? "Wird gesendet …" : "Abschicken"}
      </button>
      <p className="hint">Anonym, ohne Name oder E-Mail.</p>
    </form>
  );
}
