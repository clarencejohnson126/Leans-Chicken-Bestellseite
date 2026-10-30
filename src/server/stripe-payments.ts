import "server-only";
import type Stripe from "stripe";
import { business } from "@/config/business";
import { formatWindow } from "@/lib/format";
import { stripeProductId } from "@/lib/stripe-ids";
import { formatDay } from "@/lib/time";
import type { PaymentProvider, StoredOrder } from "@/server/ports";

// Stripe-Checkout-Adapter. Beträge kommen aus der serverseitig berechneten Bestellung (menu.ts),
// die Produkte aus dem per `npm run stripe:catalog` synchronisierten Stripe-Katalog.
// Zahlungsarten steuert die Payment Method Configuration (Karte inkl. Apple/Google Pay, SEPA).

// Stripe verlangt mindestens 30 Minuten Laufzeit. Die Reservierung in Supabase ist kürzer
// (schedule.pendingHoldMinutes); abgelaufene Sessions beendet expireStaleCheckouts aktiv.
const SESSION_LIFETIME_MS = 30 * 60_000 + 60_000;

export function createStripePayments(
  stripe: Stripe,
  options: { paymentMethodConfiguration: string; siteUrl?: string },
): PaymentProvider {
  const siteUrl = options.siteUrl ?? business.siteUrl;

  return {
    async createCheckout(order: StoredOrder) {
      const expiresMs = Date.now() + SESSION_LIFETIME_MS;
      const metadata = { order_id: order.id, order_number: order.orderNumber, source: order.source };
      const delivery = `${formatDay(order.slot.date)}, ${formatWindow(order.slot.start, order.slot.end)}`;

      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          locale: "de",
          submit_type: "pay",
          payment_method_configuration: options.paymentMethodConfiguration,
          client_reference_id: order.id,
          metadata,
          payment_intent_data: { metadata, description: `${business.name} ${order.orderNumber}` },
          line_items: order.lines.map((line) => ({
            quantity: line.quantity,
            price_data: {
              currency: "eur",
              product: stripeProductId(line.itemId),
              unit_amount: line.unitPriceCents,
            },
          })),
          custom_text: {
            submit: { message: `Bestellung ${order.orderNumber} · Lieferung ${delivery} nach ${order.customer.street}` },
          },
          expires_at: Math.floor(expiresMs / 1000),
          success_url: `${siteUrl}/bestellung/danke?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/bestellung/abgebrochen?order=${encodeURIComponent(order.orderNumber)}`,
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
  };
}
