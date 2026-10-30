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
  unsyncedOrders(target: SyncTarget, limit: number): Promise<OrderSummary[]>;
  markSynced(orderId: string, target: SyncTarget): Promise<void>;
}

export type SyncTarget = "sheet" | "notification";
