// Zahlungsarten im Stripe Checkout. Apple Pay und Google Pay laufen über "card".
// Debitkarten mit Visa-/Mastercard-Logo (z. B. neue Sparkassenkarten) zählen als Karte.
// Reine girocard funktioniert online nicht – dafür gibt es SEPA-Lastschrift.

export const payments = {
  stripeMethods: ["card", "sepa_debit"] as const,
  labels: ["Kredit- oder Debitkarte", "Apple Pay", "Google Pay", "SEPA-Lastschrift"],
  // SEPA bestätigt erst nach einigen Tagen. Für den Pilot werden SEPA-Bestellungen im Status
  // "processing" trotzdem zubereitet und geliefert; geplatzte Lastschriften lösen eine Meldung aus.
  sepa: {
    fulfillWhileProcessing: true,
  },
} as const;

export const paymentMethodsText = payments.labels.join(", ").replace(/, ([^,]*)$/, " oder $1");
