import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { createAfterPayment } from "@/server/after-payment";
import { handleStripeEvent } from "@/server/payment-events";
import type { OrderSummary, PaymentLedger, PaymentStatus, PaymentUpdate } from "@/server/ports";

// In-Memory-Ledger mit denselben Übergangsregeln wie der Supabase-Adapter.
const allowedFrom: Record<PaymentUpdate["status"], PaymentStatus[]> = {
  processing: ["pending"],
  paid: ["pending", "processing", "expired"],
  failed: ["pending", "processing"],
  expired: ["pending"],
};

function memoryLedger(status: PaymentStatus = "pending") {
  const order = { id: "order-1", orderNumber: "LEAN-1028-001", paymentStatus: status } as OrderSummary;
  const processed = new Set<string>();
  const synced = new Set<string>();
  const ledger: PaymentLedger = {
    async isEventProcessed(id) {
      return processed.has(id);
    },
    async markEventProcessed(id) {
      processed.add(id);
    },
    async applyPayment(update) {
      if (update.orderId !== order.id) return { changed: false, order: null };
      if (!allowedFrom[update.status].includes(order.paymentStatus)) return { changed: false, order };
      order.paymentStatus = update.status;
      return { changed: true, order };
    },
    async findOrderBySession() {
      return order;
    },
    async unsyncedOrders(target) {
      return synced.has(target) ? [] : [order];
    },
    async claimSync(_id, target) {
      if (synced.has(target)) return false;
      synced.add(target);
      return true;
    },
    async releaseSync(_id, target) {
      synced.delete(target);
    },
  };
  return { ledger, order };
}

function event(id: string, type: string, session: Partial<Stripe.Checkout.Session> = {}): Stripe.Event {
  return {
    id,
    type,
    data: {
      object: {
        id: "cs_test_1",
        metadata: { order_id: "order-1" },
        payment_status: "paid",
        payment_intent: "pi_1",
        customer_details: { email: "kunde@example.com" },
        ...session,
      },
    },
  } as unknown as Stripe.Event;
}

const noop = () => {};

describe("handleStripeEvent", () => {
  it("markiert eine Kartenzahlung als bezahlt und benachrichtigt einmal", async () => {
    const { ledger, order } = memoryLedger();
    const onPaid = vi.fn(async () => {});
    const result = await handleStripeEvent(event("evt_1", "checkout.session.completed"), ledger, noop, onPaid);
    expect(result).toEqual({ handled: true, changed: true, status: "paid" });
    expect(order.paymentStatus).toBe("paid");
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("überspringt doppelt zugestellte Events", async () => {
    const { ledger } = memoryLedger();
    const onPaid = vi.fn(async () => {});
    await handleStripeEvent(event("evt_1", "checkout.session.completed"), ledger, noop, onPaid);
    const again = await handleStripeEvent(event("evt_1", "checkout.session.completed"), ledger, noop, onPaid);
    expect(again).toEqual({ handled: false, reason: "duplicate" });
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("führt SEPA über processing zu paid, ohne erneut zu benachrichtigen", async () => {
    const { ledger, order } = memoryLedger();
    const onPaid = vi.fn(async () => {});
    await handleStripeEvent(event("evt_1", "checkout.session.completed", { payment_status: "unpaid" }), ledger, noop, onPaid);
    expect(order.paymentStatus).toBe("processing");
    await handleStripeEvent(event("evt_2", "checkout.session.async_payment_succeeded"), ledger, noop, onPaid);
    expect(order.paymentStatus).toBe("paid");
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("meldet geplatzte SEPA-Lastschriften als Alarm", async () => {
    const { ledger, order } = memoryLedger("processing");
    const log = vi.fn();
    await handleStripeEvent(event("evt_3", "checkout.session.async_payment_failed"), ledger, log);
    expect(order.paymentStatus).toBe("failed");
    expect(log).toHaveBeenCalledWith("payment_failed", expect.objectContaining({ alert: true }));
  });

  it("lässt ein verspätetes expired eine bezahlte Bestellung unangetastet", async () => {
    const { ledger, order } = memoryLedger("paid");
    const result = await handleStripeEvent(event("evt_4", "checkout.session.expired"), ledger, noop);
    expect(result).toEqual({ handled: true, changed: false, status: "expired" });
    expect(order.paymentStatus).toBe("paid");
  });

  it("ignoriert fremde Event-Typen und Sessions ohne Bestellung", async () => {
    const { ledger } = memoryLedger();
    expect(await handleStripeEvent(event("evt_5", "invoice.paid"), ledger, noop)).toEqual({
      handled: false,
      reason: "ignored_type",
    });
    const foreign = event("evt_6", "checkout.session.completed", { metadata: {}, client_reference_id: null });
    expect(await handleStripeEvent(foreign, ledger, noop)).toEqual({ handled: false, reason: "no_order" });
  });
});

describe("createAfterPayment", () => {
  it("markiert erfolgreiche Übertragungen und holt gescheiterte beim Retry nach", async () => {
    const { ledger, order } = memoryLedger("paid");
    const log = vi.fn();
    const sheet = vi.fn().mockRejectedValueOnce(new Error("google down")).mockResolvedValue(undefined);
    const after = createAfterPayment(ledger, { sheet }, log);

    await after.onPaid(order, "paid");
    expect(log).toHaveBeenCalledWith("sheet_sync_failed", expect.objectContaining({ orderNumber: "LEAN-1028-001" }));
    expect(await ledger.unsyncedOrders("sheet", 5)).toHaveLength(1);

    await after.retryUnsynced();
    expect(sheet).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith("sheet_sync_success", expect.anything());
    expect(await ledger.unsyncedOrders("sheet", 5)).toHaveLength(0);
  });

  it("holt Mails nur für frische Bestellungen nach, das Sheet ohne Zeitgrenze", async () => {
    const { ledger } = memoryLedger("paid");
    const spy = vi.spyOn(ledger, "unsyncedOrders");
    const after = createAfterPayment(ledger, { sheet: vi.fn(), confirmation: vi.fn() }, vi.fn());
    await after.retryUnsynced();
    const since = Object.fromEntries(spy.mock.calls.map(([target, , s]) => [target, s]));
    expect(since.sheet).toBeUndefined();
    expect(Date.now() - since.confirmation!.getTime()).toBeCloseTo(6 * 3_600_000, -4);
  });

  it("überträgt bei gleichzeitigen Webhooks nur einmal", async () => {
    const { ledger, order } = memoryLedger("paid");
    const sheet = vi.fn().mockResolvedValue(undefined);
    const after = createAfterPayment(ledger, { sheet }, vi.fn());
    await Promise.all([after.onPaid(order, "paid"), after.retryUnsynced()]);
    expect(sheet).toHaveBeenCalledTimes(1);
  });
});
