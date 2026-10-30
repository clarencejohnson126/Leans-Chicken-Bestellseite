import { describe, expect, it, vi } from "vitest";
import { createAdminOps } from "@/server/admin-ops";
import type { AdminOrder, AdminStore, PaymentProvider, PaymentStatus } from "@/server/ports";

function setup(paymentStatus: PaymentStatus = "paid", options: { failRefund?: boolean; failSheet?: boolean } = {}) {
  const order = {
    id: "order-1",
    orderNumber: "LEAN-1102-001",
    paymentStatus,
    fulfillmentStatus: "NEW",
    paymentIntentId: "pi_test",
    totalCents: 1600,
  } as AdminOrder;

  const store: AdminStore = {
    ordersForDate: async () => [order],
    getOrder: async (id) => (id === order.id ? order : null),
    async setFulfillment(id, status) {
      if (id !== order.id) return null;
      order.fulfillmentStatus = status;
      return order;
    },
    async markRefunded(id) {
      if (id !== order.id || order.paymentStatus !== "paid") return null;
      order.paymentStatus = "refunded";
      order.fulfillmentStatus = "CANCELLED";
      return order;
    },
    ordersPaused: async () => false,
    setOrdersPaused: async () => {},
  };
  const payments = {
    createCheckout: vi.fn(),
    expireCheckout: vi.fn(),
    refund: vi.fn(async () => {
      if (options.failRefund) throw new Error("card_declined");
      return { refundId: "re_1" };
    }),
  } satisfies PaymentProvider;
  const sheet = vi.fn(async () => {
    if (options.failSheet) throw new Error("sheets 503");
  });
  const onTheWay = vi.fn(async () => {});
  const log = vi.fn();
  const ops = createAdminOps({ store, payments, sheet, onTheWay, log });
  return { ops, order, payments, sheet, onTheWay, log };
}

describe("Lieferstatus aus dem Admin", () => {
  it("schreibt den neuen Status ins Sheet", async () => {
    const { ops, sheet, onTheWay } = setup();
    await ops.setStatus("order-1", "PREP", "lean@test");
    expect(sheet).toHaveBeenCalledWith("LEAN-1102-001", { fulfillment: "PREP" });
    expect(onTheWay).not.toHaveBeenCalled();
  });

  it("schickt beim Losfahren die Unterwegs-Mail", async () => {
    const { ops, onTheWay, order } = setup();
    await ops.setStatus("order-1", "OUT_FOR_DELIVERY", "lean@test");
    expect(onTheWay).toHaveBeenCalledWith(order);
  });

  it("lässt den Klick nicht scheitern, wenn das Sheet nicht erreichbar ist", async () => {
    const { ops, order, log } = setup("paid", { failSheet: true });
    await expect(ops.setStatus("order-1", "READY", "lean@test")).resolves.toBe(order);
    expect(order.fulfillmentStatus).toBe("READY");
    expect(log).toHaveBeenCalledWith("sheet_sync_failed", expect.objectContaining({ orderId: "order-1" }));
  });
});

describe("Erstattung per Knopfdruck", () => {
  it("erstattet eine bezahlte Bestellung, storniert sie und gleicht das Sheet ab", async () => {
    const { ops, order, payments, sheet } = setup("paid");
    const result = await ops.refund("order-1", "lean@test");
    expect(result.ok).toBe(true);
    expect(payments.refund).toHaveBeenCalledWith("pi_test", "order-1");
    expect(order.paymentStatus).toBe("refunded");
    expect(order.fulfillmentStatus).toBe("CANCELLED");
    expect(sheet).toHaveBeenCalledWith("LEAN-1102-001", { payment: "refunded", fulfillment: "CANCELLED" });
  });

  it("erstattet nicht doppelt", async () => {
    const { ops, payments } = setup("refunded");
    expect((await ops.refund("order-1", "lean@test")).ok).toBe(true);
    expect(payments.refund).not.toHaveBeenCalled();
  });

  it("lehnt SEPA-Zahlungen ab, die noch nicht eingegangen sind", async () => {
    const { ops, payments } = setup("processing");
    const result = await ops.refund("order-1", "lean@test");
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("SEPA") });
    expect(payments.refund).not.toHaveBeenCalled();
  });

  it("lehnt unbezahlte Bestellungen ab", async () => {
    const { ops, payments } = setup("pending");
    expect((await ops.refund("order-1", "lean@test")).ok).toBe(false);
    expect(payments.refund).not.toHaveBeenCalled();
  });

  it("lässt die Bestellung unverändert, wenn Stripe ablehnt", async () => {
    const { ops, order, log } = setup("paid", { failRefund: true });
    expect((await ops.refund("order-1", "lean@test")).ok).toBe(false);
    expect(order.paymentStatus).toBe("paid");
    expect(log).toHaveBeenCalledWith("refund_failed", expect.objectContaining({ orderId: "order-1" }));
  });
});
