import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderForm, type DayOption, type DrinkAvailability } from "@/components/order-form";
import { taxNote } from "@/config/business";
import { drinkIds, drinksEnabled, type ItemId } from "@/config/menu";
import { listDeliveryDays } from "@/lib/slots";
import { formatDay } from "@/lib/time";
import { CallButton } from "@/components/call-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { loadAdminStore, loadOrderDeps } from "@/server/integrations";

export const metadata: Metadata = {
  title: "Bestellen | Lean's Crispy Chicken",
};

export default function OrderPage({ searchParams }: PageProps<"/bestellen">) {
  return (
    <main className="wrap order-page">
      <p className="eyebrow">Vorbestellen</p>
      <h1>
        Deine <span className="brush">Bestellung</span>
      </h1>
      <p className="lead">
        Menü wählen, Lieferzeit aussuchen, bezahlen. Wir liefern in deinem Zeitfenster. {taxNote}
      </p>
      <Suspense fallback={<p className="hint" style={{ marginTop: 28 }}>Lieferzeiten werden geladen …</p>}>
        <LiveOrderForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Verfügbarkeit hängt von Uhrzeit und Buchungen ab und wird deshalb pro Anfrage berechnet. */
async function LiveOrderForm({ searchParams }: Pick<PageProps<"/bestellen">, "searchParams">) {
  await connection();
  const now = new Date();
  if (await loadAdminStore()?.ordersPaused()) {
    return (
      <div className="notice" style={{ marginTop: 28 }}>
        <p>
          <strong>Online-Bestellungen sind gerade pausiert.</strong> Schreib uns auf WhatsApp, dann schauen wir, was
          geht.
        </p>
        <div className="hero-actions">
          <WhatsAppButton label="Per WhatsApp bestellen" />
          <CallButton />
        </div>
      </div>
    );
  }
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

  // Getränke nur nach Freigabe; ohne Bestandsdaten gilt alles als ausverkauft statt unbegrenzt.
  let drinkStock: DrinkAvailability = null;
  if (drinksEnabled()) {
    const stock = deps ? await deps.store.drinkStock().catch(() => []) : [];
    drinkStock = Object.fromEntries(drinkIds.map((id) => [id, stock.find((s) => s.itemId === id)?.remaining ?? 0]));
  }
  // "Zum Warenkorb hinzufügen" auf der Startseite verlinkt auf /bestellen?add=<id>.
  const { add } = await searchParams;
  const initialItems: Partial<Record<ItemId, number>> =
    typeof add === "string" && drinkStock && (drinkStock[add as ItemId] ?? 0) > 0 ? { [add]: 1 } : {};

  return <OrderForm days={days} drinkStock={drinkStock} initialItems={initialItems} />;
}
