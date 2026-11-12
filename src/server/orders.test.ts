import { afterEach, describe, expect, it, vi } from "vitest";
import { schedule } from "@/config/schedule";
import { orderRequestSchema } from "@/lib/validation";
import { createOrder } from "@/server/orders";
import type { OrderDeps, OrderStore, PendingOrderInput, StoredOrder } from "@/server/ports";

// In-Memory-Store nur für Tests: bildet die atomare Kapazitätsprüfung der Datenbank nach.
function memoryStore(
  drinkStock: Record<string, number> = {},
): OrderStore & { orders: (StoredOrder & { status: string })[] } {
  const orders: (StoredOrder & { status: string })[] = [];
  const committed = (itemId: string) =>
    orders
      .filter((o) => o.status === "pending")
      .flatMap((o) => o.lines)
      .filter((l) => l.itemId === itemId)
      .reduce((n, l) => n + l.quantity, 0);
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
      for (const line of input.lines.filter((l) => l.kind === "drink")) {
        if (committed(line.itemId) + line.quantity > (drinkStock[line.itemId] ?? 0)) {
          return { ok: false, reason: "sold_out", itemId: line.itemId };
        }
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
    async drinkStock() {
      return Object.entries(drinkStock).map(([itemId, stock]) => ({
        itemId,
        stock,
        available: true,
        committed: committed(itemId),
        remaining: stock - committed(itemId),
      }));
    },
  };
}

const now = new Date("2026-11-24T20:00:00Z");
const noop = () => {};

function request(items: Record<string, number>, slotId = "2026-11-25_12:00") {
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

// So viele Family Packs (10 Strips), dass im Fenster nur noch 10 Strips frei sind
const nearlyFull = schedule.maxStripsPerWindow / 10 - 1;

describe("createOrder", () => {
  it("gibt die Sprache an den Checkout weiter (Standard Deutsch)", async () => {
    const d = deps();
    const spy = vi.spyOn(d.payments, "createCheckout");
    await createOrder(request({ "crunch-combo": 2 }), "website", d, now, noop);
    expect(spy.mock.calls[0][1]).toEqual({ lang: "de" });
    const en = { ...request({ "crunch-combo": 2 }), lang: "en" as const };
    await createOrder(en, "website", d, now, noop);
    expect(spy.mock.calls[1][1]).toEqual({ lang: "en" });
  });

  it("antwortet bei englischen Bestellungen auf Englisch", async () => {
    const en = { ...request({ basic: 1, ketchup: 1 }), lang: "en" as const };
    const result = await createOrder(en, "website", deps(), now, noop);
    expect(result).toMatchObject({ ok: false, code: "below_minimum" });
    expect(!result.ok && result.message).toBe("The minimum order for delivery is €14.00. Pickup works without a minimum.");
  });

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

  it("nimmt Abholung ohne Mindestbestellwert und ohne Adresse an", async () => {
    const d = deps();
    const pickup = orderRequestSchema.parse({
      items: { basic: 1 },
      fulfillment: "pickup",
      slotId: "2026-11-25_12:00",
      customer: { name: "Max", phone: "0162 1234567", street: "Irgendwo 1" },
      acceptTerms: true,
    });
    const result = await createOrder(pickup, "website", d, now, noop);
    expect(result).toMatchObject({ ok: true });
    expect(d.store.orders[0]).toMatchObject({ fulfillment: "pickup", customer: { street: "", postalCode: "" } });
  });

  it("lehnt Fenster nach Bestellschluss ab", async () => {
    const late = new Date("2026-11-25T10:15:00Z"); // 11:15 Berlin, Bestellschluss war 11:00
    const result = await createOrder(request({ "family-pack": 2 }), "website", deps(), late, noop);
    expect(result).toMatchObject({ ok: false, code: "slot_closed" });
  });

  it("verhindert Überbuchung und schlägt das nächste freie Fenster vor", async () => {
    const d = deps();
    await createOrder(request({ "family-pack": nearlyFull }), "website", d, now, noop); // Fenster bis auf 10 Strips voll
    const result = await createOrder(request({ "big-boy-box": 2 }), "website", d, now, noop); // +20
    expect(result).toMatchObject({
      ok: false,
      code: "slot_full",
      alternative: { id: "2026-11-25_12:30" },
    });
  });

  it("beendet abgelaufene Checkouts, bevor ein Platz neu vergeben wird", async () => {
    const d = deps();
    await createOrder(request({ "family-pack": nearlyFull }), "website", d, now, noop); // fast voll, unbezahlt
    const later = new Date(now.getTime() + 16 * 60_000); // Reservierung (15 Min.) ist abgelaufen
    const result = await createOrder(request({ "big-boy-box": 2 }), "website", d, later, noop);
    expect(result).toMatchObject({ ok: true });
    expect(d.payments.expireCheckout).toHaveBeenCalledWith("cs_id-1");
    expect(d.store.orders[0].status).toBe("expired");
  });

  describe("Getränke", () => {
    afterEach(() => vi.unstubAllEnvs());
    const himbeere = "brambacher-himbeere-zitrone";
    const grapefruit = "brambacher-pink-grapefruit";

    it("werden mit Pfand berechnet, beide Sorten in einer Bestellung", async () => {
      vi.stubEnv("NEXT_PUBLIC_DRINKS_PREVIEW", "1");
      const d = deps(memoryStore({ [himbeere]: 20, [grapefruit]: 20 }));
      const result = await createOrder(request({ "crunch-combo": 2, [himbeere]: 2, [grapefruit]: 1 }), "website", d, now, noop);
      expect(result).toMatchObject({ ok: true });
      // 2 × 10,00 + 3 × 3,35 + 3 × 0,15 Pfand
      expect(d.store.orders[0].totalCents).toBe(2000 + 3 * 335 + 3 * 15);
      expect(d.store.orders[0].lines.find((l) => l.itemId === himbeere)).toMatchObject({
        quantity: 2,
        unitPriceCents: 335,
        unitDepositCents: 15,
      });
    });

    it("lehnen ab, wenn die Sorte ausverkauft ist, und zählen offene Reservierungen mit", async () => {
      vi.stubEnv("NEXT_PUBLIC_DRINKS_PREVIEW", "1");
      const d = deps(memoryStore({ [himbeere]: 3 }));
      expect(await createOrder(request({ "big-boy-box": 1, [himbeere]: 2 }), "website", d, now, noop)).toMatchObject({ ok: true });
      const second = await createOrder(request({ "big-boy-box": 1, [himbeere]: 2 }), "website", d, now, noop);
      expect(second).toMatchObject({ ok: false, code: "sold_out" });
      expect(d.store.orders).toHaveLength(1);
    });

    it("brauchen weiterhin ein Menü", () => {
      vi.stubEnv("NEXT_PUBLIC_DRINKS_PREVIEW", "1");
      expect(() => request({ [himbeere]: 2 })).toThrow(/mindestens ein Menü/);
    });
  });

  it("gibt die Kapazität frei, wenn der Checkout scheitert", async () => {
    const d = deps();
    d.payments.createCheckout = vi.fn().mockRejectedValue(new Error("stripe down"));
    const result = await createOrder(request({ "family-pack": 2 }), "website", d, now, noop);
    expect(result).toMatchObject({ ok: false, code: "checkout_failed" });
    expect(d.store.orders[0].status).toBe("released");
  });
});
