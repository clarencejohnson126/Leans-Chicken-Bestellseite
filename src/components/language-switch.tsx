"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localePath, locales, stripLocale, type Locale } from "@/i18n/config";

// Sprachnamen stehen in ihrer eigenen Sprache ("Deutsch", "English"), passend zum lang-Attribut.
type Labels = { label: string } & Record<Locale, string>;

/**
 * "DE | EN" oben rechts im Header. Verlinkt dieselbe Seite in der anderen Sprache. Der Pfad wird
 * normalisiert (mit oder ohne /de bzw. /en), damit Server und Browser trotz Proxy-Rewrite dasselbe
 * HTML erzeugen.
 */
export function LanguageSwitch({ lang, labels }: { lang: Locale; labels: Labels }) {
  const base = stripLocale(usePathname() ?? "/");
  return <Switch lang={lang} labels={labels} base={base} />;
}

/** Platzhalter, solange der Pfad auf dynamischen Seiten noch nicht feststeht: verlinkt die Startseite. */
export function LanguageSwitchFallback({ lang, labels }: { lang: Locale; labels: Labels }) {
  return <Switch lang={lang} labels={labels} base="/" />;
}

function Switch({ lang, labels, base }: { lang: Locale; labels: Labels; base: string }) {
  return (
    <nav className="lang-switch" aria-label={labels.label}>
      {locales.map((l, i) => (
        <span key={l} className="lang-switch-item">
          {i > 0 && (
            <span className="lang-switch-sep" aria-hidden="true">
              |
            </span>
          )}
          {l === lang ? (
            <span className="lang-switch-link" aria-current="true" lang={l} title={labels[l]}>
              {l.toUpperCase()}
            </span>
          ) : (
            <Link
              href={localePath(l, base)}
              className="lang-switch-link"
              hrefLang={l}
              lang={l}
              aria-label={labels[l]}
              title={labels[l]}
            >
              {l.toUpperCase()}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
