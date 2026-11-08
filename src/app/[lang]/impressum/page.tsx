import type { Metadata } from "next";
import { LegalLanguageNotice } from "@/components/legal-language-notice";
import { getDictionary, resolveLocale } from "@/i18n";
import { business } from "@/config/business";

export async function generateMetadata({ params }: PageProps<"/[lang]/impressum">): Promise<Metadata> {
  const lang = await resolveLocale(params);
  return { title: getDictionary(lang).meta.imprintTitle };
}

// Rechtstext bleibt auf Deutsch (verbindlich); /en zeigt nur einen englischen Hinweis darüber.
export default async function ImprintPage({ params }: PageProps<"/[lang]/impressum">) {
  const lang = await resolveLocale(params);
  const { operator } = business;
  return (
    <main className="wrap legal" lang="de">
      <LegalLanguageNotice lang={lang} title="imprintTitle" />
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
        Telefon: {operator.legalPhone}
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
