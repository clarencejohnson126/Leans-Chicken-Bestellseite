import type { Metadata } from "next";
import { business } from "@/config/business";

export const metadata: Metadata = { title: "Impressum | Lean's Crispy Chicken" };

export default function ImprintPage() {
  const { operator } = business;
  return (
    <main className="wrap legal">
      <div className="draft-banner">Entwurf – vor Go-Live vervollständigen und rechtlich prüfen.</div>
      <h1>Impressum</h1>
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {operator.name}
        <br />
        {business.name}
        <br />
        {operator.street || "[Straße und Hausnummer ergänzen]"}
        <br />
        {operator.city}
      </p>
      <h2>Kontakt</h2>
      <p>
        Telefon: {operator.phone}
        <br />
        E-Mail: <a href={`mailto:${operator.email}`}>{operator.email}</a>
      </p>
      <h2>Umsatzsteuer</h2>
      <p>Kleinunternehmer gemäß § 19 UStG. Es wird keine Umsatzsteuer berechnet.</p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </main>
  );
}
