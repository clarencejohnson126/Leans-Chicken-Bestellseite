import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { de, type Dictionary } from "@/i18n/de";
import { en } from "@/i18n/en";

export * from "@/i18n/config";
export type { Dictionary } from "@/i18n/de";

const dictionaries: Record<Locale, Dictionary> = { de, en };

export function getDictionary(lang: Locale): Dictionary {
  return dictionaries[lang];
}

/** Liest den `lang`-Parameter einer Route. Unbekannte Sprachen ergeben eine 404. */
export async function resolveLocale(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return lang;
}

/** Prüft einen bereits gelesenen Sprachwert (z. B. aus next/root-params). Unbekannte Sprachen ergeben eine 404. */
export function resolveRootLocale(lang: string | undefined): Locale {
  if (!isLocale(lang)) notFound();
  return lang;
}
