import { intlLocale, type Locale } from "@/i18n/config";

// Deutsch: "8,00 €", Englisch: "€8.00". Beide Sprachen rechnen in Euro.
const euro: Record<Locale, Intl.NumberFormat> = {
  de: new Intl.NumberFormat(intlLocale.de, { style: "currency", currency: "EUR" }),
  en: new Intl.NumberFormat(intlLocale.en, { style: "currency", currency: "EUR" }),
};

export function formatEuro(cents: number, lang: Locale = "de") {
  return euro[lang].format(cents / 100);
}

/** Preis ohne Nachkommastellen, wenn glatt: "8 €" bzw. "€8". */
export function formatEuroShort(cents: number, lang: Locale = "de") {
  return formatEuro(cents, lang).replace(lang === "de" ? ",00" : ".00", "");
}

export function formatWindow(start: string, end: string, lang: Locale = "de") {
  return lang === "de" ? `${start}–${end} Uhr` : `${start}–${end}`;
}
