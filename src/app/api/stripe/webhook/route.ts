import { loadPaymentLedger, loadStripeWebhook } from "@/server/integrations";
import { log } from "@/server/log";
import { handleStripeEvent } from "@/server/payment-events";

// Stripe-Webhook. Signatur wird gegen den rohen Body geprüft; erst danach wird irgendetwas gelesen.
// Bei Verarbeitungsfehlern antwortet die Route mit 500, damit Stripe das Event erneut zustellt.
export async function POST(request: Request) {
  const webhook = loadStripeWebhook();
  const ledger = loadPaymentLedger();
  if (!webhook || !ledger) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "missing_signature" }, { status: 400 });

  const body = await request.text();
  let event;
  try {
    event = await webhook.stripe.webhooks.constructEventAsync(body, signature, webhook.secret);
  } catch {
    log("payment_failed", { reason: "invalid_signature" });
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event, ledger, log, webhook.afterPayment.onPaid);
    // Gelegenheit nutzen, früher gescheiterte Sheet-/Mail-Übertragungen nachzuholen.
    await webhook.afterPayment.retryUnsynced();
    return Response.json({ received: true, ...result });
  } catch (error) {
    log("payment_failed", { reason: "processing_error", eventId: event.id, type: event.type, error: String(error) });
    return Response.json({ error: "processing_error" }, { status: 500 });
  }
}
