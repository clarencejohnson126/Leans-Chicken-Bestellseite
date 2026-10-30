import "server-only";
import Stripe from "stripe";
import { createAdminOps, type AdminOps } from "@/server/admin-ops";
import { createAfterPayment, type AfterPayment, type OrderSink } from "@/server/after-payment";
import { createSheetsClient, normalizePrivateKey, type SheetsClient } from "@/server/google-sheets";
import { log } from "@/server/log";
import { createResendMailer, type Mailer } from "@/server/mailer";
import type { AdminStore, OrderDeps, OrderStore, PaymentLedger, TrackingStore } from "@/server/ports";
import { createStripePayments } from "@/server/stripe-payments";
import { createAdminStore, createSupabaseClient, createSupabaseStore } from "@/server/supabase-store";

// Baut die Adapter aus den Environment Variables. Fehlt etwas, liefern die Loader null und die
// Website fällt sauber auf "Bestell per WhatsApp" zurück, statt mit halber Konfiguration zu laufen.

type Integrations = {
  store: OrderStore & PaymentLedger;
  stripe: Stripe;
  deps: OrderDeps;
  webhookSecret: string | null;
  afterPayment: AfterPayment;
  admin: AdminStore & TrackingStore;
  adminOps: AdminOps;
};

/** Google-Sheet-Spiegel, sofern Service Account und Sheet-ID konfiguriert sind. */
function sheetsClient(env: NodeJS.ProcessEnv): SheetsClient | undefined {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: key, GOOGLE_SHEET_ID: sheetId } = env;
  if (!email || !key || !sheetId) return undefined;
  return createSheetsClient({ email, privateKey: normalizePrivateKey(key) }, sheetId);
}

/** E-Mails über Resend, sofern API-Key und verifizierter Absender konfiguriert sind. */
function mailer(env: NodeJS.ProcessEnv): Mailer | undefined {
  const { RESEND_API_KEY: apiKey, ORDER_NOTIFICATION_FROM: from, ORDER_NOTIFICATION_TO: notifyTo } = env;
  if (!apiKey || !from) return undefined;
  return createResendMailer({ apiKey, from, notifyTo: notifyTo || undefined, replyTo: notifyTo || undefined });
}

let cached: Integrations | null | undefined;

function definedSinks<T extends Record<string, OrderSink | undefined>>(sinks: T) {
  return Object.fromEntries(Object.entries(sinks).filter(([, sink]) => sink)) as Partial<Record<keyof T, OrderSink>>;
}

function build(): Integrations | null {
  const env = process.env;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = env.STRIPE_SECRET_KEY;
  const paymentMethodConfiguration = env.STRIPE_PAYMENT_METHOD_CONFIGURATION;
  if (!supabaseUrl || !supabaseKey || !stripeKey || !paymentMethodConfiguration) return null;

  const db = createSupabaseClient(supabaseUrl, supabaseKey, env.SUPABASE_SCHEMA || "leans");
  const store = createSupabaseStore(db);
  const stripe = new Stripe(stripeKey, { maxNetworkRetries: 2, appInfo: { name: "leans-bestellseite" } });
  const payments = createStripePayments(stripe, { paymentMethodConfiguration });
  const sheets = sheetsClient(env);
  const mail = mailer(env);
  const admin = createAdminStore(db);
  const sinks = definedSinks({
    sheet: sheets && ((order) => sheets.appendOrder(order)),
    notification: mail?.notification,
    confirmation: mail?.confirmation,
  });
  return {
    store,
    stripe,
    deps: { store, payments },
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || null,
    afterPayment: createAfterPayment(store, sinks, log),
    admin,
    adminOps: createAdminOps({
      store: admin,
      payments,
      sheet: sheets && ((orderNumber, update) => sheets.updateOrderStatus(orderNumber, update)),
      onTheWay: mail?.onTheWay,
      log,
    }),
  };
}

function integrations() {
  if (cached === undefined) cached = build();
  return cached;
}

/** Adapter für den Bestellablauf oder null, solange Supabase und Stripe nicht konfiguriert sind. */
export function loadOrderDeps(): OrderDeps | null {
  return integrations()?.deps ?? null;
}

export function loadPaymentLedger(): PaymentLedger | null {
  return integrations()?.store ?? null;
}

export function loadStripeWebhook(): { stripe: Stripe; secret: string; afterPayment: AfterPayment } | null {
  const i = integrations();
  return i?.webhookSecret ? { stripe: i.stripe, secret: i.webhookSecret, afterPayment: i.afterPayment } : null;
}

export function loadAdminStore(): AdminStore | null {
  return integrations()?.admin ?? null;
}

export function loadAdminOps(): AdminOps | null {
  return integrations()?.adminOps ?? null;
}

export function loadTrackingStore(): TrackingStore | null {
  return integrations()?.admin ?? null;
}
