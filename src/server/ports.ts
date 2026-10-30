import type { PricedLine } from "@/lib/pricing";
import type { Slot } from "@/lib/slots";

// Schnittstellen zu den externen Diensten. Der Order-Service kennt nur diese Typen;
// Supabase, Stripe, Google Sheets und Resend sind austauschbare Adapter dahinter.

export type OrderSource = "website" | "whatsapp";

export type CustomerData = {
  name: string;
  phone: string; // E.164
  company: string;
  street: string;
  postalCode: string;
  addressNote: string;
};

export type PendingOrderInput = {
  source: OrderSource;
  customer: CustomerData;
  slot: Pick<Slot, "id" | "date" | "start" | "end">;
  note: string;
  lines: PricedLine[];
  strips: number;
  totalCents: number;
  maxStripsPerSlot: number;
  expiresAt: Date;
};

export type StoredOrder = PendingOrderInput & {
  id: string;
  orderNumber: string; // z. B. LEAN-1028-014
};

export type CreatePendingResult =
  | { ok: true; order: StoredOrder }
  | { ok: false; reason: "capacity" };

export type CheckoutSession = {
  sessionId: string;
  url: string;
  expiresAt: Date;
};

export interface OrderStore {
  /** Belegte Strips je Slot: bezahlt, SEPA in Bearbeitung, oder offen und noch nicht abgelaufen. */
  reservedStrips(slotIds: string[]): Promise<Record<string, number>>;
  /** Prüft Kapazität und legt die Bestellung atomar an (eine Transaktion, Slot gesperrt). */
  createPendingOrder(input: PendingOrderInput): Promise<CreatePendingResult>;
  attachCheckout(orderId: string, checkout: CheckoutSession): Promise<void>;
  /** Gibt die Kapazität einer Bestellung frei, deren Checkout nicht erzeugt werden konnte. */
  releaseOrder(orderId: string, reason: string): Promise<void>;
  /** Unbezahlte Bestellungen, deren Reservierung abgelaufen ist, deren Checkout aber noch offen sein kann. */
  staleCheckouts(now: Date): Promise<{ orderId: string; sessionId: string }[]>;
  /** Markiert eine unbezahlte Bestellung als abgelaufen (nur aus "pending"). */
  expireOrder(orderId: string, reason: string): Promise<void>;
}

export interface PaymentProvider {
  createCheckout(order: StoredOrder): Promise<CheckoutSession>;
  /** Beendet einen offenen Checkout, damit er nicht mehr bezahlt werden kann. */
  expireCheckout(sessionId: string): Promise<"expired" | "already_closed">;
  /** Erstattet den vollen Betrag. Idempotent je Bestellung: ein zweiter Aufruf erstattet nicht doppelt. */
  refund(paymentIntentId: string, orderId: string): Promise<{ refundId: string }>;
}

export type OrderDeps = {
  store: OrderStore;
  payments: PaymentProvider;
};

export type PaymentStatus = "pending" | "processing" | "paid" | "expired" | "failed" | "refunded" | "released";

/** Was Danke-Seite, Benachrichtigungen und Sheet-Export über eine Bestellung wissen müssen. */
export type OrderSummary = {
  id: string;
  orderNumber: string;
  source: OrderSource;
  paymentStatus: PaymentStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  company: string;
  street: string;
  postalCode: string;
  addressNote: string;
  customerNote: string;
  slotId: string;
  deliveryDate: string; // YYYY-MM-DD
  slotStart: string; // HH:MM
  slotEnd: string; // HH:MM
  strips: number;
  totalCents: number;
  items: { itemId: string; name: string; quantity: number; lineTotalCents: number }[];
  /** Schlüssel für den öffentlichen Verfolgungslink. */
  trackingToken: string;
};

/** Ergebnis eines Stripe-Ereignisses, das der Webhook auf eine Bestellung anwendet. */
export type PaymentUpdate = {
  orderId: string;
  status: "processing" | "paid" | "failed" | "expired";
  eventType: string;
  sessionId: string;
  paymentIntentId: string | null;
  customerEmail: string | null;
};

export interface PaymentLedger {
  /** true, wenn das Stripe-Event bereits vollständig verarbeitet wurde. */
  isEventProcessed(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string, type: string): Promise<void>;
  /**
   * Setzt den Zahlungsstatus nur bei erlaubtem Übergang (z. B. nie paid → processing), damit
   * Events in beliebiger Reihenfolge und mehrfach eintreffen dürfen. changed=false heißt: nichts zu tun.
   */
  applyPayment(update: PaymentUpdate): Promise<{ changed: boolean; order: OrderSummary | null }>;
  findOrderBySession(sessionId: string): Promise<OrderSummary | null>;
  /** Bezahlte bzw. SEPA-eingereichte Bestellungen, die noch nicht ins Ziel (Sheet, Mail) übertragen wurden. */
  /** `since`: nur Bestellungen, die danach angelegt wurden (z. B. damit Mails nicht Tage später nachkommen). */
  unsyncedOrders(target: SyncTarget, limit: number, since?: Date): Promise<OrderSummary[]>;
  /**
   * Beansprucht die Übertragung atomar (setzt den Zeitstempel nur, wenn er noch leer ist). Laufen zwei
   * Webhooks gleichzeitig, bekommt nur einer true; so entsteht im Sheet nie eine doppelte Zeile.
   */
  claimSync(orderId: string, target: SyncTarget): Promise<boolean>;
  /** Gibt eine Beanspruchung nach gescheiterter Übertragung frei, damit der Retry sie nachholt. */
  releaseSync(orderId: string, target: SyncTarget): Promise<void>;
}

export type SyncTarget = "sheet" | "notification" | "confirmation";

export type FulfillmentStatus = "NEW" | "PREP" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

export type AdminOrder = OrderSummary & {
  fulfillmentStatus: FulfillmentStatus;
  createdAt: string;
  checkoutUrl: string | null;
  paymentIntentId: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
};

/** Datenzugriff für das Admin-Dashboard. Nur nach requireAdmin() verwenden. */
export interface AdminStore {
  ordersForDate(date: string): Promise<AdminOrder[]>;
  getOrder(orderId: string): Promise<AdminOrder | null>;
  setFulfillment(orderId: string, status: FulfillmentStatus, actor: string): Promise<AdminOrder | null>;
  /** paid → refunded, Lieferung storniert. null, wenn die Bestellung nicht (mehr) bezahlt war. */
  markRefunded(orderId: string, refundId: string, actor: string): Promise<AdminOrder | null>;
  ordersPaused(): Promise<boolean>;
  setOrdersPaused(paused: boolean, actor: string): Promise<void>;
}

/** Öffentliche Bestellverfolgung. Liefert nur, was der Kunde über den Link sehen darf. */
export interface TrackingStore {
  findByTrackingToken(token: string): Promise<AdminOrder | null>;
}
