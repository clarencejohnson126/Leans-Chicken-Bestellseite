import { getDictionary, type Locale } from "@/i18n";

/**
 * Rechtstexte gibt es nur auf Deutsch (rechtlich verbindlich). Auf /en steht darüber ein kurzer
 * englischer Hinweis mit dem englischen Seitentitel; auf Deutsch rendert die Komponente nichts.
 */
export function LegalLanguageNotice({ lang, title }: { lang: Locale; title: Exclude<keyof Dictionary["legal"], "germanOnly"> }) {
  if (lang === "de") return null;
  const t = getDictionary(lang).legal;
  return (
    <div className="legal-lang-notice" lang={lang} role="note">
      <strong>{t[title]}</strong>
      <p>{t.germanOnly}</p>
    </div>
  );
}

type Dictionary = ReturnType<typeof getDictionary>;
