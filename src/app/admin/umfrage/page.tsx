import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { pilot } from "@/config/business";
import { tallySurvey } from "@/lib/survey";
import { requireAdmin } from "@/server/admin-auth";
import { loadSurvey } from "@/server/integrations";

export const metadata: Metadata = {
  title: "Umfrage | Lean's Crispy Chicken",
  robots: { index: false },
};

export default function SurveyResultsPage() {
  return (
    <main className="wrap admin-page">
      <p className="eyebrow">
        <Link href="/admin">← Dashboard</Link>
      </p>
      <h1 className="admin-title">Umfrage zum Testlauf</h1>
      <p className="lead">
        Was sich die Leute bis zum {pilot.endLabel} wünschen. Öffentlicher Link:{" "}
        <Link href={pilot.surveyPath}>leanchicken.de{pilot.surveyPath}</Link>
      </p>
      <Suspense fallback={<p className="hint">Antworten werden geladen …</p>}>
        <Results />
      </Suspense>
    </main>
  );
}

const dateTime = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

async function Results() {
  await connection();
  await requireAdmin();
  const survey = loadSurvey();
  if (!survey) return <p className="notice error">Supabase ist nicht konfiguriert.</p>;
  const responses = await survey.store.surveyResponses();
  if (!responses.length) return <p className="notice">Noch keine Antworten.</p>;
  const tips = responses.filter((r) => r.tip);

  return (
    <>
      <p className="admin-production">
        <b>{responses.length}</b> Antworten · <b>{tips.length}</b> mit Tipp
      </p>
      {tallySurvey(responses).map((question) => (
        <section key={question.id} className="admin-window">
          <h2>{question.label}</h2>
          <ul className="survey-bars">
            {question.counts.map((option) => (
              <li key={option.id}>
                <span>{option.label}</span>
                <span className="survey-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${question.answered ? (option.count / question.answered) * 100 : 0}%`,
                    }}
                  />
                </span>
                <b>{option.count}</b>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {tips.length > 0 && (
        <section className="admin-window">
          <h2>Tipps</h2>
          <ul className="survey-tips">
            {tips.map((r) => (
              <li key={r.id}>
                <small>{dateTime.format(new Date(r.createdAt))}</small>
                <p>{r.tip}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
