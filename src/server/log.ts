import "server-only";

export type LogEvent =
  | "order_created"
  | "order_rejected"
  | "checkout_created"
  | "checkout_failed"
  | "checkout_expired"
  | "payment_completed"
  | "payment_failed"
  | "sheet_sync_success"
  | "sheet_sync_failed"
  | "notification_success"
  | "notification_failed"
  | "fulfillment_status_changed"
  | "refund_created"
  | "refund_failed"
  | "survey_submitted"
  | "survey_failed";

/** Strukturiertes JSON-Logging, in Vercel-Logs filterbar nach `event`. Keine Kundendaten loggen. */
export function log(event: LogEvent, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ event, ts: new Date().toISOString(), ...data });
  if (event.endsWith("_failed") || event === "order_rejected") console.error(line);
  else console.log(line);
}
