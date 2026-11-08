import { drinkRules, drinks, drinksEnabled, itemText, menus, sides } from "@/config/menu";
import { deliveryArea, schedule } from "@/config/schedule";
import { localePath, type Locale } from "@/i18n/config";
import { formatEuro } from "@/lib/format";

// Zentrale Betreiber- und Markendaten. Rechtstexte, Footer und Checkout lesen nur von hier.
export const business = {
  name: "Lean's Crispy Chicken",
  shortName: "LEAN'S",
  tagline: "Crispy Chicken. Frisch geliefert.",
  area: "FRANKLIN, Mannheim",
  // Lean's Crispy Chicken ist ein Angebot von Johnson Services (Inhaber Clarence Johnson).
  operator: {
    name: "Clarence Johnson",
    company: "Johnson Services",
    street: "George-Washington-Straße 219",
    city: "68309 Mannheim",
    // Kundenkontakt (Mails, Stripe, Website)
    email: "hallo@leanchicken.de",
    phone: "+49 179 1778957",
    // Anzeige auf der Website (dieselbe Nummer, für Anrufe und WhatsApp)
    phoneDisplay: "0179 1778957",
    // Rechtliche Angaben (Impressum, Datenschutz)
    legalEmail: "info@johnson-services.de",
    legalPhone: "+49 162 1811123",
    vatId: "DE452125652",
    taxOffice: "Finanzamt Mannheim-Neckarstadt",
  },
  websiteBy: { name: "rebelzai.com", url: "https://rebelzai.com" },
  instagram: { handle: "leanscrispychicken", url: "https://www.instagram.com/leanscrispychicken/" },
  // Kleinunternehmer nach § 19 UStG: keine Umsatzsteuer ausweisen.
  smallBusiness: true,
  whatsapp: {
    // Internationales Format ohne +, z. B. 4916212345678
    number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  },
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
} as const;

// tel:-Link zur Bestellnummer, z. B. "tel:+491791778957"
export const phoneHref = `tel:${business.operator.phone.replace(/\s/g, "")}`;

// Abholung: gleiche Zeitfenster und Fritteusen-Kapazität wie die Lieferung.
export const pickupLocation = {
  street: business.operator.street,
  city: business.operator.city,
} as const;

// Pop-up-Testlauf: begrenzter Zeitraum, in dem wir den Bedarf auf FRANKLIN testen.
export const pilot = {
  label: "Pop-up Kitchen",
  startsOn: schedule.firstDeliveryDate,
  startLabel: "16. November",
  startShort: "16.11.",
  endsOn: "2026-12-17",
  endLabel: "17. Dezember",
  endShort: "17.12.",
  surveyPath: "/umfrage",
  // Englische Datumsangaben für /en
  en: {
    startLabel: "16 November",
    startShort: "16 Nov",
    endLabel: "17 December",
    endShort: "17 Dec",
  },
} as const;

/** Datumsangaben des Testlaufs in der gewünschten Sprache. */
export function pilotDates(lang: Locale) {
  const { startLabel, startShort, endLabel, endShort } = lang === "en" ? pilot.en : pilot;
  return { startLabel, startShort, endLabel, endShort };
}

const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const weekdayNamesEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Vorausgefüllte Bestellnachricht für den WhatsApp-Button: Menü mit Preisen zum Ausfüllen, damit der
 * Kunde nicht zwischen Website und Chat wechseln muss. Preise und Zeiten kommen aus menu/schedule.
 * Bewusst ohne Emojis: Die Weiterleitung von wa.me auf WhatsApp Web zerlegt sie teils zu "�".
 */
export function whatsappOrderTemplate(lang: Locale = "de") {
  const hours = `${schedule.windows[0].start}–${schedule.windows.at(-1)!.end}`;
  const area = `${deliveryArea.postalCodes.join("/")} ${deliveryArea.label.split(",")[0]}`;
  if (lang === "en") {
    const days = schedule.deliveryWeekdays.map((d) => weekdayNamesEn[d - 1]).join("/");
    return [
      "Hi Lean's, I'd like to order:",
      "",
      ...menus.map((m) => `${m.name} (${formatEuro(m.priceCents, "en")}): `),
      `Extras – ${sides.map((s) => `${itemText(s, "en").name} ${formatEuro(s.priceCents, "en")}`).join(", ")}: `,
      ...(drinksEnabled()
        ? [
            `Drinks – ${drinkRules.brand} ${drinks.map((d) => itemText(d, "en").name).join(" / ")}, ${formatEuro(drinks[0].priceCents + drinks[0].depositCents, "en")} each incl. deposit: `,
          ]
        : []),
      "",
      `Delivery or pickup (${pickupLocation.street}): `,
      `Delivery day + time (${days}, ${hours}): `,
      "Name: ",
      `Address, delivery only (${area}): `,
    ].join("\n");
  }
  const days = schedule.deliveryWeekdays.map((d) => weekdayNames[d - 1]).join("/");
  return [
    "Hi Lean's, ich möchte bestellen:",
    "",
    ...menus.map((m) => `${m.name} (${formatEuro(m.priceCents)}): `),
    `Extras – ${sides.map((s) => `${s.name} ${formatEuro(s.priceCents)}`).join(", ")}: `,
    ...(drinksEnabled()
      ? [
          `Getränke – ${drinkRules.brand} ${drinks.map((d) => d.name).join(" / ")}, je ${formatEuro(drinks[0].priceCents + drinks[0].depositCents)} inkl. Pfand: `,
        ]
      : []),
    "",
    `Lieferung oder Abholung (${pickupLocation.street}): `,
    `Liefertag + Uhrzeit (${days}, ${hours} Uhr): `,
    "Name: ",
    `Adresse, nur bei Lieferung (${area}): `,
  ].join("\n");
}

export function whatsappLink(text?: string, lang: Locale = "de") {
  if (!business.whatsapp.number) return null;
  return `https://wa.me/${business.whatsapp.number}?text=${encodeURIComponent(text ?? whatsappOrderTemplate(lang))}`;
}

export const taxNote = business.smallBusiness
  ? "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
  : "Alle Preise inkl. MwSt.";

/** Steuerhinweis in der gewünschten Sprache. Rechtlich maßgeblich ist der deutsche Text. */
export function taxNoteFor(lang: Locale) {
  if (lang === "de") return taxNote;
  return business.smallBusiness
    ? "No VAT is charged under § 19 UStG (German small business rule)."
    : "All prices incl. VAT.";
}

/** Öffentlicher Link, unter dem der Kunde den Status seiner Bestellung verfolgt. */
export function trackingUrl(token: string, lang: Locale = "de") {
  return `${business.siteUrl}${localePath(lang, `/bestellung/verfolgen/${token}`)}`;
}

/** WhatsApp-Chat mit einem Kunden (E.164-Nummer) und vorausgefüllter Nachricht. */
export function whatsappTo(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
