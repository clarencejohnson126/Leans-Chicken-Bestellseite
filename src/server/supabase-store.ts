import "server-only";
import { createClient } from "@supabase/supabase-js";
import type {
  CheckoutSession,
  CreatePendingResult,
  OrderStore,
  OrderSummary,
  PaymentLedger,
  PaymentStatus,
  PaymentUpdate,
  PendingOrderInput,
  SyncTarget,
  AdminOrder,
  AdminStore,
  FulfillmentStatus,
  TrackingStore,
  SurveyStore,
} from "@/server/ports";

const syncColumn: Record<SyncTarget, string> = {
  sheet: "sheet_synced_at",
  notification: "notified_at",
  confirmation: "confirmation_sent_at",
};

// Supabase-Adapter für Bestellungen und Zahlungsstatus. Läuft nur auf dem Server mit dem
// Secret Key; das Schema (Standard "leans") ist per RLS für anon/authenticated gesperrt.

// Erlaubte Vorgänger je Zielstatus. Alles andere wird ignoriert (Events kommen in beliebiger Reihenfolge).
const allowedFrom: Record<PaymentUpdate["status"], PaymentStatus[]> = {
  processing: ["pending"],
  // "expired" erlaubt: Zahlt jemand im Moment des Ablaufs, wird das Geld trotzdem verbucht.
  paid: ["pending", "processing", "expired"],
  failed: ["pending", "processing"],
  expired: ["pending"],
};

type OrderRow = {
  id: string;
  order_number: string;
  source: OrderSummary["source"];
  fulfillment_type: OrderSummary["fulfillment"];
  payment_status: PaymentStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  company: string;
  street: string;
  postal_code: string;
  address_note: string;
  customer_note: string;
  slot_id: string;
  delivery_date: string;
  slot_start: string;
  slot_end: string;
  strips: number;
  total_cents: number;
  tracking_token: string;
  order_items?: { item_id: string; item_name_snapshot: string; quantity: number; unit_price_cents_snapshot: number }[];
};

const orderColumns =
  "id, order_number, source, fulfillment_type, payment_status, customer_name, customer_phone, customer_email, company, street, postal_code, address_note, customer_note, slot_id, delivery_date, slot_start, slot_end, strips, total_cents, tracking_token, order_items (item_id, item_name_snapshot, quantity, unit_price_cents_snapshot)";

function toSummary(row: OrderRow): OrderSummary {
  return {
    id: row.id,
    orderNumber: row.order_number,
    source: row.source,
    fulfillment: row.fulfillment_type,
    paymentStatus: row.payment_status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    company: row.company,
    street: row.street,
    postalCode: row.postal_code,
    addressNote: row.address_note,
    customerNote: row.customer_note,
    slotId: row.slot_id,
    deliveryDate: row.delivery_date,
    slotStart: row.slot_start.slice(0, 5),
    slotEnd: row.slot_end.slice(0, 5),
    strips: row.strips,
    totalCents: row.total_cents,
    items: (row.order_items ?? []).map((i) => ({
      itemId: i.item_id,
      name: i.item_name_snapshot,
      quantity: i.quantity,
      lineTotalCents: i.quantity * i.unit_price_cents_snapshot,
    })),
    trackingToken: row.tracking_token,
  };
}

function fail(action: string, error: { message: string } | null): never {
  throw new Error(`supabase ${action}: ${error?.message ?? "unbekannter Fehler"}`);
}

export function createSupabaseClient(url: string, secretKey: string, schema: string) {
  return createClient(url, secretKey, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createSupabaseStore(db: ReturnType<typeof createSupabaseClient>): OrderStore & PaymentLedger {
  async function addEvent(orderId: string, type: string, detail: Record<string, unknown> = {}) {
    const { error } = await db.from("order_events").insert({ order_id: orderId, type, detail });
    if (error) fail("order_events.insert", error);
  }

  return {
    async reservedStrips(slotIds) {
      const { data, error } = await db.rpc("reserved_strips", { p_slot_ids: slotIds });
      if (error) fail("reserved_strips", error);
      return Object.fromEntries(
        (data as { slot_id: string; strips: number }[]).map((r) => [r.slot_id, Number(r.strips)]),
      );
    },

    async createPendingOrder(input: PendingOrderInput): Promise<CreatePendingResult> {
      const { data, error } = await db.rpc("create_pending_order", {
        p_order: {
          source: input.source,
          fulfillment_type: input.fulfillment,
          customer_name: input.customer.name,
          customer_phone: input.customer.phone,
          company: input.customer.company,
          street: input.customer.street,
          postal_code: input.customer.postalCode,
          address_note: input.customer.addressNote,
          customer_note: input.note,
          slot_id: input.slot.id,
          delivery_date: input.slot.date,
          slot_start: input.slot.start,
          slot_end: input.slot.end,
          strips: input.strips,
          total_cents: input.totalCents,
          expires_at: input.expiresAt.toISOString(),
        },
        p_items: input.lines.map((l) => ({
          item_id: l.itemId,
          kind: l.kind,
          name: l.name,
          unit_price_cents: l.unitPriceCents,
          quantity: l.quantity,
          strips: l.strips,
          fries: l.fries,
        })),
        p_max_strips: input.maxStripsPerSlot,
      });
      if (error) fail("create_pending_order", error);
      const row = (data as { id: string; order_number: string }[])[0];
      if (!row) return { ok: false, reason: "capacity" };
      return { ok: true, order: { ...input, id: row.id, orderNumber: row.order_number } };
    },

    async attachCheckout(orderId, checkout: CheckoutSession) {
      const { error } = await db
        .from("orders")
        .update({ stripe_checkout_session_id: checkout.sessionId, checkout_url: checkout.url })
        .eq("id", orderId);
      if (error) fail("orders.attachCheckout", error);
      await addEvent(orderId, "checkout_created", { session_id: checkout.sessionId });
    },

    async releaseOrder(orderId, reason) {
      const { error } = await db
        .from("orders")
        .update({ payment_status: "released" })
        .eq("id", orderId)
        .eq("payment_status", "pending");
      if (error) fail("orders.release", error);
      await addEvent(orderId, "order_released", { reason });
    },

    async staleCheckouts(now) {
      const { data, error } = await db
        .from("orders")
        .select("id, stripe_checkout_session_id")
        .eq("payment_status", "pending")
        .lt("expires_at", now.toISOString())
        .not("stripe_checkout_session_id", "is", null)
        .limit(20);
      if (error) fail("orders.staleCheckouts", error);
      return (data as { id: string; stripe_checkout_session_id: string }[]).map((r) => ({
        orderId: r.id,
        sessionId: r.stripe_checkout_session_id,
      }));
    },

    async expireOrder(orderId, reason) {
      const { error } = await db
        .from("orders")
        .update({ payment_status: "expired" })
        .eq("id", orderId)
        .eq("payment_status", "pending");
      if (error) fail("orders.expire", error);
      await addEvent(orderId, "order_expired", { reason });
    },

    async isEventProcessed(eventId) {
      const { data, error } = await db.from("stripe_events").select("id").eq("id", eventId).maybeSingle();
      if (error) fail("stripe_events.select", error);
      return data !== null;
    },

    async markEventProcessed(eventId, type) {
      const { error } = await db.from("stripe_events").upsert({ id: eventId, type }, { ignoreDuplicates: true });
      if (error) fail("stripe_events.upsert", error);
    },

    async applyPayment(update) {
      const patch: Record<string, unknown> = {
        payment_status: update.status,
        stripe_checkout_session_id: update.sessionId,
      };
      if (update.paymentIntentId) patch.stripe_payment_intent_id = update.paymentIntentId;
      if (update.customerEmail) patch.customer_email = update.customerEmail;
      if (update.status === "paid") patch.paid_at = new Date().toISOString();

      const { data, error } = await db
        .from("orders")
        .update(patch)
        .eq("id", update.orderId)
        .in("payment_status", allowedFrom[update.status])
        .select(orderColumns);
      if (error) fail("orders.applyPayment", error);

      const changedRow = (data as unknown as OrderRow[])[0];
      if (changedRow) {
        await addEvent(update.orderId, `payment_${update.status}`, {
          stripe_event: update.eventType,
          session_id: update.sessionId,
        });
        return { changed: true, order: toSummary(changedRow) };
      }

      const { data: current, error: readError } = await db
        .from("orders")
        .select(orderColumns)
        .eq("id", update.orderId)
        .maybeSingle();
      if (readError) fail("orders.select", readError);
      return { changed: false, order: current ? toSummary(current as unknown as OrderRow) : null };
    },

    async unsyncedOrders(target, limit, since) {
      let query = db
        .from("orders")
        .select(orderColumns)
        .in("payment_status", ["paid", "processing"])
        .is(syncColumn[target], null);
      if (since) query = query.gte("created_at", since.toISOString());
      const { data, error } = await query.order("created_at").limit(limit);
      if (error) fail("orders.unsynced", error);
      return (data as unknown as OrderRow[]).map(toSummary);
    },

    async claimSync(orderId, target) {
      const { data, error } = await db
        .from("orders")
        .update({ [syncColumn[target]]: new Date().toISOString() })
        .eq("id", orderId)
        .is(syncColumn[target], null)
        .select("id");
      if (error) fail("orders.claimSync", error);
      return (data ?? []).length > 0;
    },

    async releaseSync(orderId, target) {
      const { error } = await db.from("orders").update({ [syncColumn[target]]: null }).eq("id", orderId);
      if (error) fail("orders.releaseSync", error);
    },

    async findOrderBySession(sessionId) {
      const { data, error } = await db
        .from("orders")
        .select(orderColumns)
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle();
      if (error) fail("orders.findBySession", error);
      return data ? toSummary(data as unknown as OrderRow) : null;
    },
  };
}

type AdminRow = OrderRow & {
  fulfillment_status: FulfillmentStatus;
  created_at: string;
  checkout_url: string | null;
  stripe_payment_intent_id: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
};

function toAdminOrder(row: AdminRow): AdminOrder {
  return {
    ...toSummary(row),
    fulfillmentStatus: row.fulfillment_status,
    createdAt: row.created_at,
    checkoutUrl: row.checkout_url,
    paymentIntentId: row.stripe_payment_intent_id,
    outForDeliveryAt: row.out_for_delivery_at,
    deliveredAt: row.delivered_at,
  };
}

// Zeitstempel je Lieferstatus. Zurück auf einen früheren Schritt löscht die späteren.
function fulfillmentTimestamps(status: FulfillmentStatus, now: string) {
  if (status === "OUT_FOR_DELIVERY") return { out_for_delivery_at: now, delivered_at: null };
  if (status === "DELIVERED") return { delivered_at: now };
  return { out_for_delivery_at: null, delivered_at: null };
}

export function createAdminStore(db: ReturnType<typeof createSupabaseClient>): AdminStore & TrackingStore {
  const columns = `${orderColumns}, fulfillment_status, created_at, checkout_url, stripe_payment_intent_id, out_for_delivery_at, delivered_at`;

  async function addEvent(orderId: string, type: string, detail: Record<string, unknown>, actor: string) {
    const { error } = await db.from("order_events").insert({ order_id: orderId, type, detail, actor });
    if (error) fail("admin.order_events.insert", error);
  }

  async function one(column: string, value: string) {
    const { data, error } = await db.from("orders").select(columns).eq(column, value).maybeSingle();
    if (error) fail(`admin.orderBy.${column}`, error);
    return data ? toAdminOrder(data as unknown as AdminRow) : null;
  }

  return {
    async ordersForDate(date) {
      const { data, error } = await db
        .from("orders")
        .select(columns)
        .eq("delivery_date", date)
        .in("payment_status", ["pending", "processing", "paid", "failed", "refunded"])
        .order("slot_start")
        .order("created_at");
      if (error) fail("admin.ordersForDate", error);
      return (data as unknown as AdminRow[]).map(toAdminOrder);
    },

    getOrder(orderId) {
      return one("id", orderId);
    },

    findByTrackingToken(token) {
      return one("tracking_token", token);
    },

    async setFulfillment(orderId, status, actor) {
      const patch = { fulfillment_status: status, ...fulfillmentTimestamps(status, new Date().toISOString()) };
      const { data, error } = await db.from("orders").update(patch).eq("id", orderId).select(columns).maybeSingle();
      if (error) fail("admin.setFulfillment", error);
      await addEvent(orderId, "fulfillment_status_changed", { status }, actor);
      return data ? toAdminOrder(data as unknown as AdminRow) : null;
    },

    async markRefunded(orderId, refundId, actor) {
      const { data, error } = await db
        .from("orders")
        .update({
          payment_status: "refunded",
          fulfillment_status: "CANCELLED",
          refunded_at: new Date().toISOString(),
          stripe_refund_id: refundId,
        })
        .eq("id", orderId)
        .eq("payment_status", "paid")
        .select(columns)
        .maybeSingle();
      if (error) fail("admin.markRefunded", error);
      if (data) await addEvent(orderId, "payment_refunded", { refund_id: refundId }, actor);
      return data ? toAdminOrder(data as unknown as AdminRow) : null;
    },

    async ordersPaused() {
      const { data, error } = await db.from("settings").select("value").eq("key", "orders_paused").maybeSingle();
      if (error) fail("admin.ordersPaused", error);
      return data?.value === true;
    },

    async setOrdersPaused(paused, actor) {
      const { error } = await db
        .from("settings")
        .upsert({ key: "orders_paused", value: paused, updated_at: new Date().toISOString() });
      if (error) fail("admin.setOrdersPaused", error);
      console.log(JSON.stringify({ event: "orders_paused_changed", paused, actor, ts: new Date().toISOString() }));
    },
  };
}

export function createSurveyStore(db: ReturnType<typeof createSupabaseClient>): SurveyStore {
  return {
    async saveSurveyResponse({ answers, tip }) {
      const { data, error } = await db.from("survey_responses").insert({ answers, tip }).select("id").single();
      if (error || !data) fail("survey_responses.insert", error);
      return { id: data.id as string };
    },
    async surveyResponses() {
      const { data, error } = await db
        .from("survey_responses")
        .select("id, answers, tip, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) fail("survey_responses.select", error);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        answers: row.answers as Record<string, string[]>,
        tip: row.tip as string,
        createdAt: row.created_at as string,
      }));
    },
  };
}
