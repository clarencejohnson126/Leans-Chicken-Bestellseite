import "server-only";
import Stripe from "stripe";
import { createAfterPayment, type AfterPayment, type OrderSink } from "@/server/after-payment";
import { createSheetsClient, normalizePrivateKey } from "@/server/google-sheets";
import { log } from "@/server/log";
import type { OrderDeps, OrderStore, PaymentLedger } from "@/server/ports";
import { createStripePayments } from "@/server/stripe-payments";
import { createSupabaseClient, createSupabaseStore } from "@/server/supabase-store";

// Baut die Adapter aus den Environment Variables. Fehlt etwas, liefern die Loader null und die
// Website fällt sauber auf "Bestell per WhatsApp" zurück, statt mit halber Konfiguration zu laufen.

type Integrations = {
  store: OrderStore & PaymentLedger;
  stripe: Stripe;
  deps: OrderDeps;
  webhookSecret: string | null;
  afterPayment: AfterPayment;
};

/** Google-Sheet-Spiegel, sofern Service Account und Sheet-ID konfiguriert sind. */
function sheetSink(env: NodeJS.ProcessEnv): OrderSink | undefined {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: key, GOOGLE_SHEET_ID: sheetId } = env;
  if (!email || !key || !sheetId) return undefined;
  const sheets = createSheetsClient({ email, privateKey: normalizePrivateKey(key) }, sheetId);
  return (order) => sheets.appendOrder(order);
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

  const store = createSupabaseStore(createSupabaseClient(supabaseUrl, supabaseKey, env.SUPABASE_SCHEMA || "leans"));
  const stripe = new Stripe(stripeKey, { maxNetworkRetries: 2, appInfo: { name: "leans-bestellseite" } });
  return {
    store,
    stripe,
    deps: { store, payments: createStripePayments(stripe, { paymentMethodConfiguration }) },
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || null,
    afterPayment: createAfterPayment(store, definedSinks({ sheet: sheetSink(env) }), log),
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
