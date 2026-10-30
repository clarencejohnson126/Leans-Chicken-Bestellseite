import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderForm, type DayOption } from "@/components/order-form";
import { taxNote } from "@/config/business";
import { listDeliveryDays } from "@/lib/slots";
import { formatDay } from "@/lib/time";
import { loadOrderDeps } from "@/server/integrations";

export const metadata: Metadata = {
  title: "Bestellen | Lean's Crispy Chicken",
};

export default function OrderPage() {
  return (
    <main className="wrap order-page">
      <p className="eyebrow">Vorbestellen</p>
      <h1>
        Deine <span className="brush">Bestellung</span>
      </h1>
      <p className="lead">
        Menü wählen, Lieferzeit aussuchen, bezahlen. Lean bringt&apos;s mit dem Rad. {taxNote}
      </p>
      <Suspense fallback={<p className="hint" style={{ marginTop: 28 }}>Lieferzeiten werden geladen …</p>}>
        <LiveOrderForm />
      </Suspense>
    </main>
  );
}

/** Verfügbarkeit hängt von Uhrzeit und Buchungen ab und wird deshalb pro Anfrage berechnet. */
async function LiveOrderForm() {
  await connection();
  const now = new Date();
  const deps = loadOrderDeps();
  const slotIds = listDeliveryDays(now).flatMap((d) => d.slots.map((s) => s.id));
  const reserved = deps ? await deps.store.reservedStrips(slotIds) : {};

  const days: DayOption[] = listDeliveryDays(now, reserved).map((d) => ({
    date: d.date,
    label: formatDay(d.date),
    shortLabel: formatDay(d.date, "short"),
    slots: d.slots.map((s) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      open: s.open,
      remainingStrips: s.remainingStrips,
    })),
  }));

  return <OrderForm days={days} />;
}
