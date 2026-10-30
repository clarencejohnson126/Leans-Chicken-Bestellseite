"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, signIn, signOut } from "@/server/admin-auth";
import { loadAdminStore } from "@/server/integrations";
import { log } from "@/server/log";
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
  const store = loadAdminStore();
  if (!store) return;
  await store.setFulfillment(orderId, status, admin.email);
  log("fulfillment_status_changed", { orderId, status });
  refresh();
}

export async function setPausedAction(formData: FormData) {
  const admin = await requireAdmin();
  const store = loadAdminStore();
  if (!store) return;
  await store.setOrdersPaused(formData.get("paused") === "true", admin.email);
  refresh();
}
