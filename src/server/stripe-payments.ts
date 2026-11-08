import "server-only";
import type Stripe from "stripe";
import { business, pickupLocation } from "@/config/business";
import { drinkRules, findItem, itemText } from "@/config/menu";
import { localePath, type Locale } from "@/i18n/config";
import { formatWindow } from "@/lib/format";
import { stripeProductId } from "@/lib/stripe-ids";
import { formatDay } from "@/lib/time";
import type { PaymentProvider, StoredOrder } from "@/server/ports";

// Stripe-Checkout-Adapter. Beträge kommen aus der serverseitig berechneten Bestellung (menu.ts),
// die Produkte aus dem per `npm run stripe:catalog` synchronisierten Stripe-Katalog.
// Zahlungsarten steuert die Payment Method Configuration (Karte inkl. Apple/Google Pay, SEPA).

// Stripe verlangt mindestens 30 Minuten Laufzeit. Die Reservierung in Supabase kann kürzer sein
// (schedule.pendingHoldMinutes); abgelaufene Sessions beendet expireStaleCheckouts aktiv. Längere
// Reservierungen (WhatsApp-Zahlungslinks) bekommen eine Minute Puffer über das Reservierungsende.
const MIN_SESSION_LIFETIME_MS = 30 * 60_000 + 60_000;

/** Englischer Anzeigename eines Produkts; gespeichert ist der deutsche. */
function englishName(itemId: string, fallback: string) {
  const item = findItem(itemId);
  return item ? itemText(item, "en").name : fallback;
}

export function createStripePayments(
  stripe: Stripe,
  options: { paymentMethodConfiguration: string; siteUrl?: string },
): PaymentProvider {
  const siteUrl = options.siteUrl ?? business.siteUrl;

  return {
    async createCheckout(order: StoredOrder, checkoutOptions?: { lang?: Locale }) {
      const lang = checkoutOptions?.lang ?? "de";
      const en = lang === "en";
      const expiresMs = Math.max(Date.now() + MIN_SESSION_LIFETIME_MS, order.expiresAt.getTime() + 60_000);
      const metadata = { order_id: order.id, order_number: order.orderNumber, source: order.source };
      const delivery = `${formatDay(order.slot.date, "long", lang)}, ${formatWindow(order.slot.start, order.slot.end, lang)}`;

      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          locale: lang,
          submit_type: "pay",
          payment_method_configuration: options.paymentMethodConfiguration,
          client_reference_id: order.id,
          metadata,
          payment_intent_data: { metadata, description: `${business.name} ${order.orderNumber}` },
          line_items: order.lines.flatMap((line) => [
            {
              quantity: line.quantity,
              price_data: {
                currency: "eur",
                product: stripeProductId(line.itemId),
                unit_amount: line.unitPriceCents,
              },
            },
            // Pfand als eigene Zeile, damit er auf Beleg und in der Auswertung vom Umsatz getrennt bleibt.
            ...(line.unitDepositCents > 0
              ? [
                  {
                    quantity: line.quantity,
                    price_data: {
                      currency: "eur",
                      product_data: {
                        name: en
                          ? `Deposit ${englishName(line.itemId, line.name)}`
                          : `${drinkRules.depositLabel} ${line.name}`,
                      },
                      unit_amount: line.unitDepositCents,
                    },
                  },
                ]
              : []),
          ]),
          custom_text: {
            submit: {
              message:
                (en
                  ? order.fulfillment === "pickup"
                    ? `Order ${order.orderNumber} · Pickup ${delivery} at ${pickupLocation.street}`
                    : `Order ${order.orderNumber} · Delivery ${delivery} to ${order.customer.street}`
                  : order.fulfillment === "pickup"
                    ? `Bestellung ${order.orderNumber} · Abholung ${delivery} in der ${pickupLocation.street}`
                    : `Bestellung ${order.orderNumber} · Lieferung ${delivery} nach ${order.customer.street}`) +
                // Website-Kunden bestätigen die AGB im Formular, WhatsApp-Kunden mit der Zahlung.
                (order.source === "whatsapp" ? ` · Es gelten unsere AGB: ${siteUrl}/agb` : ""),
            },
          },
          expires_at: Math.floor(expiresMs / 1000),
          success_url: `${siteUrl}${localePath(lang, "/bestellung/danke")}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}${localePath(lang, "/bestellung/abgebrochen")}?order=${encodeURIComponent(order.orderNumber)}`,
        },
        { idempotencyKey: `checkout_${order.id}` },
      );

      if (!session.url) throw new Error("Stripe hat keine Checkout-URL geliefert");
      return { sessionId: session.id, url: session.url, expiresAt: new Date(session.expires_at * 1000) };
    },

    async expireCheckout(sessionId) {
      try {
        await stripe.checkout.sessions.expire(sessionId);
        return "expired";
      } catch (error) {
        // Bereits bezahlt oder abgelaufen: Stripe lehnt ab, der Webhook regelt den Rest.
        if ((error as { type?: string }).type === "StripeInvalidRequestError") return "already_closed";
        throw error;
      }
    },

    async refund(paymentIntentId, orderId) {
      const refund = await stripe.refunds.create(
        { payment_intent: paymentIntentId, reason: "requested_by_customer", metadata: { order_id: orderId } },
        { idempotencyKey: `refund_${orderId}` },
      );
      return { refundId: refund.id };
    },
  };
}
