// Liefertage, Lieferfenster und Kapazität. Alle Uhrzeiten sind Ortszeit Europe/Berlin.

export const schedule = {
  timeZone: "Europe/Berlin",
  // ISO-Wochentage: 1 = Montag … 7 = Sonntag
  deliveryWeekdays: [1, 3, 4],
  windows: [
    { start: "11:30", end: "12:00" },
    { start: "12:00", end: "12:30" },
    { start: "12:30", end: "13:00" },
    { start: "13:00", end: "13:30" },
    { start: "13:30", end: "14:00" },
    { start: "14:00", end: "14:30" },
    { start: "14:30", end: "15:00" },
  ],
  // Produktionsgrenze pro Lieferfenster in Chicken Strips (Fritteusen-Kapazität).
  maxStripsPerWindow: 100,
  // Bestellschluss: so viele Minuten vor Beginn des Lieferfensters. Die Minute selbst zählt noch mit:
  // Wer um 12:00 bestellt, bekommt noch das Fenster 12:30–13:00.
  orderLeadMinutes: 30,
  // Erster Liefertag des Testlaufs. Davor ist nichts buchbar; vorbestellen geht schon vorher,
  // der Buchungshorizont zählt dann ab diesem Tag.
  firstDeliveryDate: "2026-11-16",
  // Wie viele Kalendertage im Voraus bestellt werden kann.
  daysAhead: 7,
  // Unbezahlte Bestellungen halten Kapazität so lange. Stripe-Sessions laufen technisch mindestens
  // 30 Minuten; abgelaufene Reservierungen werden deshalb vor jeder neuen Bestellung aktiv beendet.
  pendingHoldMinutes: 15,
  // Zahlungslinks aus WhatsApp-Bestellungen reservieren länger, weil der Kunde sie erst öffnen muss.
  whatsappHoldMinutes: 60,
} as const;

// Lieferradius über Postleitzahl. FRANKLIN liegt in 68309; Adresse wird zusätzlich manuell geprüft.
export const deliveryArea = {
  label: "FRANKLIN, Mannheim",
  postalCodes: ["68309"],
  city: "Mannheim",
} as const;
