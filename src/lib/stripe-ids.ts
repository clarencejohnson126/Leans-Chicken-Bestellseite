// Stripe-Produkt-IDs für Katalog-Items. Gemeinsam genutzt vom Katalog-Sync (scripts/stripe-catalog.mts)
// und vom Checkout, damit beide garantiert dieselben Produkte meinen.
export function stripeProductId(itemId: string) {
  return `leans_${itemId.replace(/-/g, "_")}`;
}
