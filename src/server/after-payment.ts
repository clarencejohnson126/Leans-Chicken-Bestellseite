import type { PaidHook } from "@/server/payment-events";
import type { OrderSummary, PaymentLedger, SyncTarget } from "@/server/ports";

// Was nach einem Zahlungseingang passiert: Zeile ins Google Sheet, Benachrichtigung an Lean.
// Jedes Ziel ist optional und unabhängig. Fehler werden geloggt, nie geworfen: Die Bestellung ist
// in Supabase sicher, und retryUnsynced trägt fehlende Übertragungen beim nächsten Webhook nach.

export type SyncLogEvent = "sheet_sync_success" | "sheet_sync_failed" | "notification_success" | "notification_failed";
type Logger = (event: SyncLogEvent, data: Record<string, unknown>) => void;

export type OrderSink = (order: OrderSummary) => Promise<void>;

const events: Record<SyncTarget, { ok: SyncLogEvent; failed: SyncLogEvent }> = {
  sheet: { ok: "sheet_sync_success", failed: "sheet_sync_failed" },
  notification: { ok: "notification_success", failed: "notification_failed" },
};

export function createAfterPayment(
  ledger: PaymentLedger,
  sinks: Partial<Record<SyncTarget, OrderSink>>,
  log: Logger,
) {
  const targets = Object.entries(sinks) as [SyncTarget, OrderSink][];

  async function deliver(target: SyncTarget, sink: OrderSink, order: OrderSummary) {
    try {
      await sink(order);
      await ledger.markSynced(order.id, target);
      log(events[target].ok, { orderId: order.id, orderNumber: order.orderNumber });
    } catch (error) {
      log(events[target].failed, { orderId: order.id, orderNumber: order.orderNumber, error: String(error) });
    }
  }

  const onPaid: PaidHook = async (order) => {
    await Promise.all(targets.map(([target, sink]) => deliver(target, sink, order)));
  };

  /** Überträgt bis zu `limit` Bestellungen je Ziel, deren erster Versuch gescheitert ist. */
  async function retryUnsynced(limit = 5) {
    for (const [target, sink] of targets) {
      try {
        for (const order of await ledger.unsyncedOrders(target, limit)) await deliver(target, sink, order);
      } catch (error) {
        log(events[target].failed, { retry: true, error: String(error) });
      }
    }
  }

  return { onPaid, retryUnsynced };
}

export type AfterPayment = ReturnType<typeof createAfterPayment>;
