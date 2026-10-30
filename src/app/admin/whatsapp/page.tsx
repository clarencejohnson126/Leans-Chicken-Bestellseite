import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { WhatsAppOrderForm, type AdminDayOption } from "@/app/admin/whatsapp/whatsapp-order-form";
import { listDeliveryDays } from "@/lib/slots";
import { formatDay } from "@/lib/time";
import { requireAdmin } from "@/server/admin-auth";
import { loadOrderDeps } from "@/server/integrations";

export const metadata: Metadata = { title: "WhatsApp-Bestellung | Lean's Crispy Chicken", robots: { index: false } };

export default function WhatsAppOrderPage() {
  return (
    <main className="wrap admin-page">
      <p className="eyebrow">
        <Link href="/admin">← Dashboard</Link>
      </p>
      <h1 className="admin-title">WhatsApp-Bestellung</h1>
      <p className="lead">Bestellung aus dem Chat eintragen, Zahlungslink erzeugen und dem Kunden per WhatsApp schicken.</p>
      <Suspense fallback={<p className="hint">Lieferzeiten werden geladen …</p>}>
        <Form />
      </Suspense>
    </main>
  );
}

async function Form() {
  await connection();
  await requireAdmin();
  const now = new Date();
  const deps = loadOrderDeps();
  if (!deps) return <p className="notice error">Supabase/Stripe sind nicht konfiguriert.</p>;
  const reserved = await deps.store.reservedStrips(listDeliveryDays(now).flatMap((d) => d.slots.map((s) => s.id)));
  const days: AdminDayOption[] = listDeliveryDays(now, reserved).map((d) => ({
    date: d.date,
    label: formatDay(d.date),
    slots: d.slots.map((s) => ({ id: s.id, start: s.start, end: s.end, open: s.open, remainingStrips: s.remainingStrips })),
  }));
  return <WhatsAppOrderForm days={days} />;
}
