// Sprachen der Kundenseiten. Deutsch ist Standard und liegt ohne Präfix unter den bisherigen URLs,
// Englisch unter /en/… mit denselben Pfadsegmenten. Die Admin-Oberfläche bleibt deutsch.

export const locales = ["de", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "de";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** BCP-47-Tag für Intl-Formatierung (Datum, Preise). */
export const intlLocale: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

/** Open-Graph-Locale je Sprache. */
export const ogLocale: Record<Locale, string> = { de: "de_DE", en: "en_US" };

/**
 * Pfad in der gewünschten Sprache: Deutsch bleibt unverändert, Englisch bekommt /en davor.
 * Query und Hash bleiben erhalten, z. B. ("en", "/#menue") → "/en#menue",
 * ("en", "/bestellen?add=x#drinks") → "/en/bestellen?add=x#drinks".
 */
export function localePath(lang: Locale, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (lang === defaultLocale) return normalized;
  const match = /^([^?#]*)(.*)$/.exec(normalized)!;
  const pathname = match[1];
  const rest = match[2];
  return `/${lang}${pathname === "/" ? "" : pathname}${rest}`;
}

/**
 * Entfernt ein Sprachpräfix (/de oder /en) und gibt den sprachneutralen Pfad zurück.
 * "/en/bestellen" → "/bestellen", "/en" → "/", "/de/agb" → "/agb", "/bestellen" → "/bestellen".
 */
export function stripLocale(pathname: string): string {
  for (const lang of locales) {
    if (pathname === `/${lang}`) return "/";
    if (pathname.startsWith(`/${lang}/`)) return pathname.slice(lang.length + 1);
  }
  return pathname || "/";
}

/** Ersetzt Platzhalter wie {name} in einem Wörterbuch-String. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
