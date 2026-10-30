import type { AdminOrder, AdminStore, FulfillmentStatus, OrderSummary, PaymentProvider, PaymentStatus } from "@/server/ports";

// Was Lean im Admin auslöst: Lieferstatus setzen (inkl. Sheet-Abgleich und "Unterwegs"-Mail) und
// Erstattungen. Supabase wird zuerst geschrieben; Sheet und Mail sind Nebenwirkungen, deren Fehler
// nur geloggt werden und den Klick im Admin nie scheitern lassen.

type AdminLogEvent =
  | "fulfillment_status_changed"
  | "sheet_sync_success"
  | "sheet_sync_failed"
  | "notification_success"
  | "notification_failed"
  | "refund_created"
  | "refund_failed";
type Logger = (event: AdminLogEvent, data: Record<string, unknown>) => void;

export type SheetStatusSync = (
  orderNumber: string,
  update: { fulfillment?: FulfillmentStatus; payment?: PaymentStatus },
) => Promise<unknown>;

export type AdminOpsDeps = {
  store: AdminStore;
  payments: PaymentProvider;
  sheet?: SheetStatusSync;
  onTheWay?: (order: OrderSummary) => Promise<void>;
  log: Logger;
};

export type RefundResult = { ok: true; order: AdminOrder } | { ok: false; message: string };

export function createAdminOps({ store, payments, sheet, onTheWay, log }: AdminOpsDeps) {
  async function attempt(ok: AdminLogEvent, failed: AdminLogEvent, data: Record<string, unknown>, run: () => Promise<unknown>) {
    try {
      await run();
      log(ok, data);
    } catch (error) {
      log(failed, { ...data, error: String(error) });
    }
  }

  async function syncSheet(order: AdminOrder, update: Parameters<SheetStatusSync>[1]) {
    if (!sheet) return;
    await attempt("sheet_sync_success", "sheet_sync_failed", { orderId: order.id, kind: "status" }, () =>
      sheet(order.orderNumber, update),
    );
  }

  return {
    async setStatus(orderId: string, status: FulfillmentStatus, actor: string) {
      const order = await store.setFulfillment(orderId, status, actor);
      if (!order) return null;
      log("fulfillment_status_changed", { orderId, status });
      await Promise.all([
        syncSheet(order, { fulfillment: status }),
        status === "OUT_FOR_DELIVERY" && onTheWay
          ? attempt("notification_success", "notification_failed", { orderId, kind: "on_the_way" }, () => onTheWay(order))
          : undefined,
      ]);
      return order;
    },

    async refund(orderId: string, actor: string): Promise<RefundResult> {
      const order = await store.getOrder(orderId);
      if (!order) return { ok: false, message: "Bestellung nicht gefunden." };
      if (order.paymentStatus === "refunded") return { ok: true, order };
      if (order.paymentStatus === "processing") {
        return { ok: false, message: "Die SEPA-Lastschrift ist noch nicht eingegangen. Erstatten geht, sobald sie bestätigt ist." };
      }
      if (order.paymentStatus !== "paid" || !order.paymentIntentId) {
        return { ok: false, message: "Nur bezahlte Bestellungen können erstattet werden." };
      }

      let refundId: string;
      try {
        ({ refundId } = await payments.refund(order.paymentIntentId, order.id));
      } catch (error) {
        log("refund_failed", { orderId, error: String(error) });
        return { ok: false, message: "Stripe hat die Erstattung abgelehnt. Details stehen im Stripe-Dashboard." };
      }

      const updated = (await store.markRefunded(order.id, refundId, actor)) ?? order;
      log("refund_created", { orderId, refundId, amountCents: order.totalCents });
      await syncSheet(updated, { payment: "refunded", fulfillment: "CANCELLED" });
      return { ok: true, order: updated };
    },
  };
}

export type AdminOps = ReturnType<typeof createAdminOps>;
