import type { Metadata } from "next";
import { SurveyForm } from "@/app/umfrage/survey-form";
import { pilot } from "@/config/business";

export const metadata: Metadata = {
  title: "Umfrage zum Testlauf | Lean's Crispy Chicken",
  description: `${pilot.label} auf FRANKLIN: Sag uns in 30 Sekunden, wann du Lean's gern hättest.`,
};

export default function SurveyPage() {
  return (
    <main className="wrap survey-page">
      <p className="eyebrow">
        {pilot.label} · Start {pilot.startLabel} · bis {pilot.endLabel}
      </p>
      <h1>
        Wann hättest du gern <span className="brush">Lean&apos;s?</span>
      </h1>
      <p className="lead">
        Wir testen gerade, wann FRANKLIN Lust auf Crispy Chicken hat. Vier kurze Fragen, 30 Sekunden, und du
        entscheidest mit, wie es nach dem Testlauf weitergeht.
      </p>
      <SurveyForm />
    </main>
  );
}
