import type Stripe from "stripe";
import type { OrderSummary, PaymentLedger, PaymentUpdate } from "@/server/ports";

// Übersetzt Stripe-Webhook-Events in Zahlungsstatus. Einzige Stelle, die eine Bestellung als
// bezahlt markiert. Idempotent: doppelte Events werden über stripe_events übersprungen, und der
// Ledger erlaubt nur gültige Statusübergänge.

export type PaymentLogEvent = "payment_completed" | "payment_failed";
type Logger = (event: PaymentLogEvent, data: Record<string, unknown>) => void;

/** Wird beim ersten Zahlungseingang einer Bestellung aufgerufen (Phase 5: Sheet + E-Mail). */
export type PaidHook = (order: OrderSummary, status: PaymentUpdate["status"]) => Promise<void>;

export type HandleResult =
  | { handled: true; changed: boolean; status: PaymentUpdate["status"] }
  | { handled: false; reason: "duplicate" | "ignored_type" | "no_order" };

function statusFor(event: Stripe.Event): PaymentUpdate["status"] | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // SEPA meldet "unpaid", bis die Lastschrift bestätigt ist; Karte meldet sofort "paid".
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") return "paid";
      return "processing";
    }
    case "checkout.session.async_payment_succeeded":
      return "paid";
    case "checkout.session.async_payment_failed":
      return "failed";
    case "checkout.session.expired":
      return "expired";
    default:
      return null;
  }
}

export async function handleStripeEvent(
  event: Stripe.Event,
  ledger: PaymentLedger,
  log: Logger,
  onPaid?: PaidHook,
): Promise<HandleResult> {
  const status = statusFor(event);
  if (!status) return { handled: false, reason: "ignored_type" };
  if (await ledger.isEventProcessed(event.id)) return { handled: false, reason: "duplicate" };

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  if (!orderId) {
    // Fremde Sessions (z. B. Test-Sessions aus dem Dashboard) gehören zu keiner Bestellung.
    await ledger.markEventProcessed(event.id, event.type);
    return { handled: false, reason: "no_order" };
  }

  const paymentIntent = session.payment_intent;
  const { changed, order } = await ledger.applyPayment({
    orderId,
    status,
    eventType: event.type,
    sessionId: session.id,
    paymentIntentId: typeof paymentIntent === "string" ? paymentIntent : (paymentIntent?.id ?? null),
    customerEmail: session.customer_details?.email ?? null,
  });

  if (changed && order) {
    if (status === "paid" || status === "processing") {
      log("payment_completed", { orderId, orderNumber: order.orderNumber, status, eventId: event.id });
      // Nur einmal pro Bestellung benachrichtigen: bei SEPA zählt schon "processing" als Eingang.
      const firstConfirmation = event.type === "checkout.session.completed";
      if (onPaid && firstConfirmation) await onPaid(order, status);
    } else if (status === "failed") {
      log("payment_failed", { orderId, orderNumber: order.orderNumber, eventId: event.id, alert: true });
    }
  }

  await ledger.markEventProcessed(event.id, event.type);
  return { handled: true, changed, status };
}
