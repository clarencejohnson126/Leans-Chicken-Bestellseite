"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { itemIds } from "@/config/menu";
import { formatEuro } from "@/lib/format";
import { priceCart } from "@/lib/pricing";
import { orderRequestSchema } from "@/lib/validation";
import { requireAdmin, signIn, signOut } from "@/server/admin-auth";
import { loadAdminOps, loadAdminStore, loadOrderDeps } from "@/server/integrations";
import { log } from "@/server/log";
import { createOrder } from "@/server/orders";
import type { FulfillmentStatus } from "@/server/ports";

const statuses: FulfillmentStatus[] = ["NEW", "PREP", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

export async function loginAction(_prev: { error: string } | null, formData: FormData) {
  const ok = await signIn(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!ok) return { error: "E-Mail oder Passwort stimmt nicht." };
  redirect("/admin");
}

export async function logoutAction() {
  await signOut();
  redirect("/admin/login");
}

export async function setStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as FulfillmentStatus;
  if (!orderId || !statuses.includes(status)) return;
  await loadAdminOps()?.setStatus(orderId, status, admin.email);
  refresh();
}

export async function setPausedAction(formData: FormData) {
  const admin = await requireAdmin();
  const store = loadAdminStore();
  if (!store) return;
  await store.setOrdersPaused(formData.get("paused") === "true", admin.email);
  refresh();
}

export async function refundAction(_prev: { error: string } | null, formData: FormData) {
  const admin = await requireAdmin();
  const ops = loadAdminOps();
  if (!ops) return { error: "Stripe ist nicht konfiguriert." };
  const result = await ops.refund(String(formData.get("orderId") ?? ""), admin.email);
  if (!result.ok) return { error: result.message };
  refresh();
  return null;
}

export type WhatsAppOrderState =
  | {
      ok: true;
      orderNumber: string;
      checkoutUrl: string;
      phone: string;
      firstName: string;
      total: string;
      pickup: boolean;
    }
  | { ok: false; error: string; fields?: Record<string, string> }
  | null;

/** Legt eine Bestellung aus einem WhatsApp-Chat an und liefert den Stripe-Zahlungslink zum Weiterschicken. */
export async function createWhatsAppOrderAction(
  _prev: WhatsAppOrderState,
  formData: FormData,
): Promise<WhatsAppOrderState> {
  await requireAdmin();
  const field = (name: string) => String(formData.get(name) ?? "");
  const items = Object.fromEntries(
    itemIds.map((id) => [id, Number(formData.get(`item_${id}`) || 0)] as const).filter(([, n]) => n > 0),
  );
  const parsed = orderRequestSchema.safeParse({
    items,
    fulfillment: field("fulfillment") === "pickup" ? "pickup" : "delivery",
    slotId: field("slotId"),
    customer: {
      name: field("name"),
      phone: field("phone"),
      company: field("company"),
      street: field("street"),
      postalCode: field("postalCode"),
      addressNote: field("addressNote"),
    },
    note: field("note"),
    // Der Kunde akzeptiert die AGB mit der Zahlung; der Hinweis steht im Stripe-Checkout.
    acceptTerms: true,
  });
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return { ok: false, error: "Bitte Angaben prüfen.", fields };
  }

  const deps = loadOrderDeps();
  if (!deps) return { ok: false, error: "Supabase/Stripe sind nicht konfiguriert." };
  const result = await createOrder(parsed.data, "whatsapp", deps, new Date(), log);
  if (!result.ok) {
    const hint = result.alternative ? ` Nächstes freies Fenster: ${result.alternative.start} Uhr.` : "";
    return { ok: false, error: result.message + hint };
  }
  refresh();
  return {
    ok: true,
    orderNumber: result.orderNumber,
    checkoutUrl: result.checkoutUrl,
    phone: parsed.data.customer.phone,
    firstName: parsed.data.customer.name.split(" ")[0],
    total: formatEuro(priceCart(parsed.data.items, parsed.data.fulfillment).totalCents),
    pickup: parsed.data.fulfillment === "pickup",
  };
}
