import { menus, sides } from "@/config/menu";
import { deliveryArea, schedule } from "@/config/schedule";
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
    // Rechtliche Angaben (Impressum, Datenschutz)
    legalEmail: "info@johnson-services.de",
    legalPhone: "+49 162 1811123",
    vatId: "DE452125652",
    taxOffice: "Finanzamt Mannheim-Neckarstadt",
  },
  websiteBy: { name: "rebelzai.com", url: "https://rebelzai.com" },
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

const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Vorausgefüllte Bestellnachricht für den WhatsApp-Button: Menü mit Preisen zum Ausfüllen, damit der
 * Kunde nicht zwischen Website und Chat wechseln muss. Preise und Zeiten kommen aus menu/schedule.
 * Bewusst ohne Emojis: Die Weiterleitung von wa.me auf WhatsApp Web zerlegt sie teils zu "�".
 */
export function whatsappOrderTemplate() {
  const days = schedule.deliveryWeekdays.map((d) => weekdayNames[d - 1]).join("/");
  const hours = `${schedule.windows[0].start}–${schedule.windows.at(-1)!.end}`;
  return [
    "Hi Lean's, ich möchte bestellen:",
    "",
    ...menus.map((m) => `${m.name} (${formatEuro(m.priceCents)}): `),
    `Extras – ${sides.map((s) => `${s.name} ${formatEuro(s.priceCents)}`).join(", ")}: `,
    "",
    `Liefertag + Uhrzeit (${days}, ${hours} Uhr): `,
    "Name: ",
    `Adresse (${deliveryArea.postalCodes.join("/")} ${deliveryArea.label.split(",")[0]}): `,
  ].join("\n");
}

export function whatsappLink(text: string = whatsappOrderTemplate()) {
  if (!business.whatsapp.number) return null;
  return `https://wa.me/${business.whatsapp.number}?text=${encodeURIComponent(text)}`;
}

export const taxNote = business.smallBusiness
  ? "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
  : "Alle Preise inkl. MwSt.";

/** Öffentlicher Link, unter dem der Kunde den Status seiner Bestellung verfolgt. */
export function trackingUrl(token: string) {
  return `${business.siteUrl}/bestellung/verfolgen/${token}`;
}

/** WhatsApp-Chat mit einem Kunden (E.164-Nummer) und vorausgefüllter Nachricht. */
export function whatsappTo(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
