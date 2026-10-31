import { schedule } from "@/config/schedule";
import { formatEuro } from "@/lib/format";
import { minOrderCents, priceCart } from "@/lib/pricing";
import {
  isSlotOpen,
  isWithinHorizon,
  listDeliveryDays,
  nextAvailableSlot,
  resolveSlot,
  type Slot,
} from "@/lib/slots";
import type { OrderRequest } from "@/lib/validation";
import type { OrderDeps, OrderSource } from "@/server/ports";

export type CreateOrderResult =
  | { ok: true; orderNumber: string; checkoutUrl: string }
  | {
      ok: false;
      code: "invalid_slot" | "slot_closed" | "below_minimum" | "slot_full" | "checkout_failed";
      message: string;
      alternative?: Pick<Slot, "id" | "date" | "start" | "end">;
    };

type OrderLogEvent = "order_created" | "order_rejected" | "checkout_created" | "checkout_failed" | "checkout_expired";
type Logger = (event: OrderLogEvent, data: Record<string, unknown>) => void;

/**
 * Legt eine Bestellung an und erzeugt den Checkout. Preise, Mindestbestellwert, Bestellschluss
 * und Kapazität werden hier serverseitig entschieden, unabhängig davon, was der Client anzeigt.
 */
export async function createOrder(
  request: OrderRequest,
  source: OrderSource,
  deps: OrderDeps,
  now: Date,
  log: Logger,
): Promise<CreateOrderResult> {
  const slot = resolveSlot(request.slotId);
  if (!slot || !isWithinHorizon(slot, now)) {
    log("order_rejected", { reason: "invalid_slot", slotId: request.slotId });
    return { ok: false, code: "invalid_slot", message: "Diese Lieferzeit gibt es nicht." };
  }
  if (!isSlotOpen(slot, now)) {
    log("order_rejected", { reason: "slot_closed", slotId: slot.id });
    return {
      ok: false,
      code: "slot_closed",
      message: "Bestellschluss für diese Lieferzeit ist erreicht. Bitte wähle eine spätere Zeit.",
    };
  }

  const cart = priceCart(request.items, request.fulfillment);
  if (!cart.meetsMinimum) {
    log("order_rejected", { reason: "below_minimum", totalCents: cart.totalCents });
    return {
      ok: false,
      code: "below_minimum",
      message: `Der Mindestbestellwert für die Lieferung beträgt ${formatEuro(minOrderCents(request.fulfillment))}. Abholen geht auch ohne.`,
    };
  }

  await expireStaleCheckouts(deps, now, log);

  const created = await deps.store.createPendingOrder({
    source,
    fulfillment: request.fulfillment,
    customer: request.customer,
    slot: { id: slot.id, date: slot.date, start: slot.start, end: slot.end },
    note: request.note,
    lines: cart.lines,
    strips: cart.strips,
    totalCents: cart.totalCents,
    maxStripsPerSlot: schedule.maxStripsPerWindow,
    // WhatsApp-Kunden bekommen den Zahlungslink per Nachricht und brauchen länger als jemand im Checkout.
    expiresAt: new Date(
      now.getTime() + (source === "whatsapp" ? schedule.whatsappHoldMinutes : schedule.pendingHoldMinutes) * 60_000,
    ),
  });

  if (!created.ok) {
    const slotIds = listDeliveryDays(now).flatMap((d) => d.slots.map((s) => s.id));
    const reserved = await deps.store.reservedStrips(slotIds);
    const alternative = nextAvailableSlot(listDeliveryDays(now, reserved), cart.strips, slot.id);
    log("order_rejected", { reason: "slot_full", slotId: slot.id, strips: cart.strips });
    return {
      ok: false,
      code: "slot_full",
      message: "Für diese Lieferzeit sind nicht mehr genug Chicken Strips frei.",
      alternative: alternative
        ? { id: alternative.id, date: alternative.date, start: alternative.start, end: alternative.end }
        : undefined,
    };
  }

  const order = created.order;
  log("order_created", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    source,
    fulfillment: request.fulfillment,
    slotId: slot.id,
  });

  try {
    const checkout = await deps.payments.createCheckout(order);
    await deps.store.attachCheckout(order.id, checkout);
    log("checkout_created", { orderId: order.id, sessionId: checkout.sessionId });
    return { ok: true, orderNumber: order.orderNumber, checkoutUrl: checkout.url };
  } catch (error) {
    await deps.store.releaseOrder(order.id, "checkout_failed");
    log("checkout_failed", { orderId: order.id, error: String(error) });
    return {
      ok: false,
      code: "checkout_failed",
      message: "Die Bezahlseite konnte gerade nicht geöffnet werden. Bitte versuch es gleich nochmal.",
    };
  }
}

/**
 * Reservierungen laufen nach schedule.pendingHoldMinutes ab, Stripe-Sessions aber frühestens nach
 * 30 Minuten. Bevor neue Kapazität vergeben wird, werden abgelaufene Checkouts deshalb aktiv beendet,
 * damit niemand mehr auf einen bereits freigegebenen Platz bezahlen kann. Fehler hier blockieren
 * keine neue Bestellung.
 */
export async function expireStaleCheckouts(deps: OrderDeps, now: Date, log: Logger) {
  try {
    for (const stale of await deps.store.staleCheckouts(now)) {
      const outcome = await deps.payments.expireCheckout(stale.sessionId);
      if (outcome === "expired") await deps.store.expireOrder(stale.orderId, "hold_elapsed");
      log("checkout_expired", { orderId: stale.orderId, sessionId: stale.sessionId, outcome });
    }
  } catch (error) {
    log("checkout_expired", { error: String(error) });
  }
}
