// Zentrale Betreiber- und Markendaten. Rechtstexte, Footer und Checkout lesen nur von hier.
export const business = {
  name: "Lean's Crispy Chicken",
  shortName: "LEAN'S",
  tagline: "Crispy Chicken. Mit dem Rad zu dir.",
  area: "FRANKLIN, Mannheim",
  operator: {
    name: "Clarence Johnson",
    // TODO vor Go-Live: ladungsfähige Anschrift für Impressum ergänzen.
    street: "",
    city: "68309 Mannheim",
    email: "clarencejohnson@hotmail.de",
    phone: "+49 179 1778957",
  },
  // Kleinunternehmer nach § 19 UStG: keine Umsatzsteuer ausweisen.
  smallBusiness: true,
  whatsapp: {
    // Internationales Format ohne +, z. B. 4916212345678
    number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
    orderText: "Hi Lean's 👋 Ich möchte gerne bestellen.",
  },
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
} as const;

export function whatsappLink(text: string = business.whatsapp.orderText) {
  if (!business.whatsapp.number) return null;
  return `https://wa.me/${business.whatsapp.number}?text=${encodeURIComponent(text)}`;
}

export const taxNote = business.smallBusiness
  ? "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
  : "Alle Preise inkl. MwSt.";
