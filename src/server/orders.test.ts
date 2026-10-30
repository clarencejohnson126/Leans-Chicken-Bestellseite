import { describe, expect, it, vi } from "vitest";
import { orderRequestSchema } from "@/lib/validation";
import { createOrder } from "@/server/orders";
import type { OrderDeps, OrderStore, PendingOrderInput, StoredOrder } from "@/server/ports";

// In-Memory-Store nur für Tests: bildet die atomare Kapazitätsprüfung der Datenbank nach.
function memoryStore(): OrderStore & { orders: (StoredOrder & { status: string })[] } {
  const orders: (StoredOrder & { status: string })[] = [];
  const reserved = (slotId: string) =>
    orders.filter((o) => o.slot.id === slotId && o.status === "pending").reduce((n, o) => n + o.strips, 0);
  return {
    orders,
    async reservedStrips(slotIds) {
      return Object.fromEntries(slotIds.map((id) => [id, reserved(id)]));
    },
    async createPendingOrder(input: PendingOrderInput) {
      if (reserved(input.slot.id) + input.strips > input.maxStripsPerSlot) {
        return { ok: false, reason: "capacity" };
      }
      const order = { ...input, id: `id-${orders.length + 1}`, orderNumber: `LEAN-1028-${String(orders.length + 1).padStart(3, "0")}`, status: "pending" };
      orders.push(order);
      return { ok: true, order };
    },
    async attachCheckout() {},
    async releaseOrder(orderId) {
      const o = orders.find((x) => x.id === orderId);
      if (o) o.status = "released";
    },
    async staleCheckouts(at) {
      return orders
        .filter((o) => o.status === "pending" && o.expiresAt < at)
        .map((o) => ({ orderId: o.id, sessionId: `cs_${o.id}` }));
    },
    async expireOrder(orderId) {
      const o = orders.find((x) => x.id === orderId);
      if (o?.status === "pending") o.status = "expired";
    },
  };
}

const now = new Date("2026-10-27T20:00:00Z");
const noop = () => {};

function request(items: Record<string, number>, slotId = "2026-10-28_12:00") {
  return orderRequestSchema.parse({
    items,
    slotId,
    customer: { name: "Max", phone: "0162 1234567", street: "Robert-Funari-Str. 1", postalCode: "68309" },
    acceptTerms: true,
  });
}

function deps(store = memoryStore()): OrderDeps & { store: ReturnType<typeof memoryStore> } {
  return {
    store,
    payments: {
      createCheckout: async (order) => ({
        sessionId: `cs_${order.id}`,
        url: `https://checkout.test/${order.id}`,
        expiresAt: order.expiresAt,
      }),
      expireCheckout: vi.fn(async () => "expired" as const),
      refund: vi.fn(async () => ({ refundId: "re_test" })),
    },
  };
}

describe("createOrder", () => {
  it("legt eine Bestellung an und gibt die Checkout-URL zurück", async () => {
    const d = deps();
    const result = await createOrder(request({ "crunch-combo": 2 }), "website", d, now, noop);
    expect(result).toEqual({ ok: true, orderNumber: "LEAN-1028-001", checkoutUrl: "https://checkout.test/id-1" });
    expect(d.store.orders[0].totalCents).toBe(2000);
    expect(d.store.orders[0].strips).toBe(10);
    expect(d.store.orders[0].expiresAt.getTime() - now.getTime()).toBe(15 * 60_000);
  });

  it("reserviert für WhatsApp-Zahlungslinks länger", async () => {
    const d = deps();
    await createOrder(request({ "crunch-combo": 2 }), "whatsapp", d, now, noop);
    expect(d.store.orders[0].source).toBe("whatsapp");
    expect(d.store.orders[0].expiresAt.getTime() - now.getTime()).toBe(60 * 60_000);
  });

  it("lehnt Bestellungen unter dem Mindestbestellwert ab", async () => {
    const result = await createOrder(request({ basic: 1, ketchup: 1 }), "website", deps(), now, noop);
    expect(result).toMatchObject({ ok: false, code: "below_minimum" });
  });

  it("lehnt Fenster nach Bestellschluss ab", async () => {
    const late = new Date("2026-10-28T10:15:00Z"); // 11:15 Berlin, Schluss für 12:00 war 11:00
    const result = await createOrder(request({ "family-pack": 2 }), "website", deps(), late, noop);
    expect(result).toMatchObject({ ok: false, code: "slot_closed" });
  });

  it("verhindert Überbuchung und schlägt das nächste freie Fenster vor", async () => {
    const d = deps();
    await createOrder(request({ "family-pack": 9 }), "website", d, now, noop); // 90 von 100 Strips
    const result = await createOrder(request({ "big-boy-box": 2 }), "website", d, now, noop); // +20
    expect(result).toMatchObject({
      ok: false,
      code: "slot_full",
      alternative: { id: "2026-10-28_12:30" },
    });
  });

  it("beendet abgelaufene Checkouts, bevor ein Platz neu vergeben wird", async () => {
    const d = deps();
    await createOrder(request({ "family-pack": 9 }), "website", d, now, noop); // 90 von 100, unbezahlt
    const later = new Date(now.getTime() + 16 * 60_000); // Reservierung (15 Min.) ist abgelaufen
    const result = await createOrder(request({ "big-boy-box": 2 }), "website", d, later, noop);
    expect(result).toMatchObject({ ok: true });
    expect(d.payments.expireCheckout).toHaveBeenCalledWith("cs_id-1");
    expect(d.store.orders[0].status).toBe("expired");
  });

  it("gibt die Kapazität frei, wenn der Checkout scheitert", async () => {
    const d = deps();
    d.payments.createCheckout = vi.fn().mockRejectedValue(new Error("stripe down"));
    const result = await createOrder(request({ "family-pack": 2 }), "website", d, now, noop);
    expect(result).toMatchObject({ ok: false, code: "checkout_failed" });
    expect(d.store.orders[0].status).toBe("released");
  });
});
