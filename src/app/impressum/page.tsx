import type { Metadata } from "next";
import { business } from "@/config/business";

export const metadata: Metadata = { title: "Impressum | Lean's Crispy Chicken" };

export default function ImprintPage() {
  const { operator } = business;
  return (
    <main className="wrap legal">
      <h1>Impressum</h1>
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {operator.name}
        <br />
        {operator.company}
        <br />
        {operator.street}
        <br />
        {operator.city}
      </p>
      <p>
        {business.name} ist ein Unternehmen von {operator.company}.
      </p>
      <h2>Kontakt</h2>
      <p>
        Telefon: {operator.phone}
        <br />
        E-Mail: <a href={`mailto:${operator.legalEmail}`}>{operator.legalEmail}</a>
      </p>
      <h2>Umsatzsteuer</h2>
      <p>
        Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {operator.vatId}
        <br />
        Zuständiges Finanzamt: {operator.taxOffice}
      </p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
      <h2>Website</h2>
      <p>
        Erstellt von{" "}
        <a href={business.websiteBy.url} target="_blank" rel="noopener noreferrer">
          {business.websiteBy.name}
        </a>
      </p>
    </main>
  );
}
