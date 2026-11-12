import type { Locale } from "@/i18n/config";

// Fehlermeldungen rund um die Bestellung, die der Kunde im Formular sieht. Liegen getrennt von den
// großen Wörterbüchern, weil Validierung (Client + Server) und Order-Service sie brauchen.

export type OrderMessages = {
  maxQuantity: (max: number) => string;
  requireMenu: string;
  drinksDisabled: string;
  name: string;
  phone: string;
  slot: string;
  acceptTerms: string;
  street: string;
  postalCode: (area: string, postalCodes: string) => string;
  // Server
  invalidJson: string;
  validation: string;
  notConfigured: string;
  paused: string;
  invalidSlot: string;
  slotClosed: string;
  belowMinimum: (amount: string) => string;
  soldOut: (name: string | undefined) => string;
  slotFull: string;
  checkoutFailed: string;
};

const de: OrderMessages = {
  maxQuantity: (max) => `Maximal ${max} Stück pro Position. Für größere Mengen schreib uns auf WhatsApp.`,
  requireMenu: "Bitte wähle mindestens ein Menü.",
  drinksDisabled: "Getränke sind noch nicht bestellbar.",
  name: "Bitte gib deinen Namen an.",
  phone: "Bitte gib eine gültige Mobilnummer an.",
  slot: "Bitte wähle eine Zeit.",
  acceptTerms: "Bitte bestätige AGB und Datenschutzerklärung.",
  street: "Bitte gib Straße und Hausnummer an.",
  postalCode: (area, postalCodes) => `Wir liefern aktuell nur nach ${area} (PLZ ${postalCodes}). Abholen geht immer.`,
  invalidJson: "Ungültige Anfrage.",
  validation: "Bitte prüfe deine Angaben.",
  notConfigured: "Die Online-Bezahlung wird gerade eingerichtet. Bestell gern solange per WhatsApp.",
  paused: "Online-Bestellungen sind gerade pausiert. Schreib uns gern auf WhatsApp.",
  invalidSlot: "Diese Lieferzeit gibt es nicht.",
  slotClosed: "Bestellschluss für diesen Tag ist erreicht (11:00 Uhr). Bitte wähle einen anderen Liefertag.",
  belowMinimum: (amount) => `Der Mindestbestellwert für die Lieferung beträgt ${amount}. Abholen geht auch ohne.`,
  soldOut: (name) =>
    `${name ?? "Dieses Getränk"} ist leider ausverkauft (oder nicht mehr in deiner Menge da). Bitte passe die Getränke an.`,
  slotFull: "Für diese Lieferzeit sind nicht mehr genug Chicken Strips frei.",
  checkoutFailed: "Die Bezahlseite konnte gerade nicht geöffnet werden. Bitte versuch es gleich nochmal.",
};

const en: OrderMessages = {
  maxQuantity: (max) => `Max. ${max} per item. For bigger orders, message us on WhatsApp.`,
  requireMenu: "Please choose at least one meal.",
  drinksDisabled: "Drinks can't be ordered yet.",
  name: "Please enter your name.",
  phone: "Please enter a valid mobile number.",
  slot: "Please choose a time.",
  acceptTerms: "Please accept the terms and privacy policy.",
  street: "Please enter your street and house number.",
  postalCode: (area, postalCodes) =>
    `We currently only deliver to ${area} (postcode ${postalCodes}). Pickup is always possible.`,
  invalidJson: "Invalid request.",
  validation: "Please check your details.",
  notConfigured: "Online payment is being set up right now. Feel free to order via WhatsApp in the meantime.",
  paused: "Online orders are paused right now. Just message us on WhatsApp.",
  invalidSlot: "This delivery time doesn't exist.",
  slotClosed: "Orders for this day have closed (11:00). Please choose another delivery day.",
  belowMinimum: (amount) => `The minimum order for delivery is ${amount}. Pickup works without a minimum.`,
  soldOut: (name) =>
    `Sorry, ${name ?? "this drink"} is sold out (or not available in your quantity any more). Please adjust your drinks.`,
  slotFull: "There aren't enough Chicken Strips left for this delivery time.",
  checkoutFailed: "We couldn't open the payment page just now. Please try again in a moment.",
};

export const orderMessages: Record<Locale, OrderMessages> = { de, en };
