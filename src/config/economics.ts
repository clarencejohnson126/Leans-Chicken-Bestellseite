import "server-only";
import { business } from "@/config/business";

// Kalkulationswerte nur für den Admin (nicht im Client-Bundle). Vorläufig, Stand 02.11.2026.
export const drinkEconomics = {
  // Einkaufspreis je Flasche ohne Pfand. Das Pfand zahlt ihr dem Händler und bekommt es bei Rückgabe
  // zurück; es ist durchlaufender Posten und zählt weder als Umsatz noch als Kosten.
  purchaseCents: 99,
  // Getränke unterliegen 19 % USt (auch das Pfand teilt den Steuersatz der Ware). Als Kleinunternehmer
  // nach § 19 UStG fällt keine an.
  vatRate: business.smallBusiness ? 0 : 0.19,
  // Stripe-Gebühr, die ein zusätzliches Getränk im selben Checkout verursacht (prozentualer Anteil,
  // die Fixgebühr fällt pro Zahlung ohnehin an). EU-Karten, Standardtarif.
  paymentFeeRate: 0.015,
} as const;

/** Deckungsbeitrag je Flasche in Cent: Netto-Verkaufspreis minus Einkauf minus Zahlungsgebühr. */
export function drinkMarginCents(priceCents: number, depositCents: number) {
  const net = priceCents / (1 + drinkEconomics.vatRate);
  const fee = (priceCents + depositCents) * drinkEconomics.paymentFeeRate;
  return Math.round(net - drinkEconomics.purchaseCents - fee);
}
