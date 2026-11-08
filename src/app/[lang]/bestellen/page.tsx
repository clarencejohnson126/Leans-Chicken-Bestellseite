import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CallButton } from "@/components/call-button";
import { OrderForm, type DayOption, type DrinkAvailability } from "@/components/order-form";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { taxNoteFor } from "@/config/business";
import { drinkIds, drinksEnabled, type ItemId } from "@/config/menu";
import { getDictionary, resolveLocale, type Locale } from "@/i18n";
import { listDeliveryDays } from "@/lib/slots";
import { formatDay } from "@/lib/time";
import { loadAdminStore, loadOrderDeps } from "@/server/integrations";

export async function generateMetadata({ params }: PageProps<"/[lang]/bestellen">): Promise<Metadata> {
  const lang = await resolveLocale(params);
  return { title: getDictionary(lang).meta.orderTitle };
}

export default async function OrderPage({ params, searchParams }: PageProps<"/[lang]/bestellen">) {
  const lang = await resolveLocale(params);
  const t = getDictionary(lang).order;
  return (
    <main className="wrap order-page">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>
        {t.titleBefore}
        <span className="brush">{t.titleBrush}</span>
      </h1>
      <p className="lead">{t.lead(taxNoteFor(lang))}</p>
      <Suspense fallback={<p className="hint" style={{ marginTop: 28 }}>{t.loading}</p>}>
        <LiveOrderForm searchParams={searchParams} lang={lang} />
      </Suspense>
    </main>
  );
}

/** Verfügbarkeit hängt von Uhrzeit und Buchungen ab und wird deshalb pro Anfrage berechnet. */
async function LiveOrderForm({
  searchParams,
  lang,
}: Pick<PageProps<"/[lang]/bestellen">, "searchParams"> & { lang: Locale }) {
  await connection();
  const now = new Date();
  const dict = getDictionary(lang);
  if (await loadAdminStore()?.ordersPaused()) {
    return (
      <div className="notice" style={{ marginTop: 28 }}>
        <p>
          <strong>{dict.order.pausedStrong}</strong>
          {dict.order.pausedText}
        </p>
        <div className="hero-actions">
          <WhatsAppButton label={dict.buttons.whatsappOrderShort} lang={lang} />
          <CallButton lang={lang} />
        </div>
      </div>
    );
  }
  const deps = loadOrderDeps();
  const slotIds = listDeliveryDays(now).flatMap((d) => d.slots.map((s) => s.id));
  const reserved = deps ? await deps.store.reservedStrips(slotIds) : {};

  const days: DayOption[] = listDeliveryDays(now, reserved).map((d) => ({
    date: d.date,
    label: formatDay(d.date, "long", lang),
    shortLabel: formatDay(d.date, "short", lang),
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

  return (
    <OrderForm
      days={days}
      drinkStock={drinkStock}
      initialItems={initialItems}
      lang={lang}
      labels={dict.orderForm}
      drinkLabels={dict.drinkCard}
      menuImageLabels={dict.menuImage}
    />
  );
}
