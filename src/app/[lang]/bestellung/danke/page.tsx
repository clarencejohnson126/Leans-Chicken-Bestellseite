import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { pickupLocation } from "@/config/business";
import { depositLabel } from "@/config/menu";
import { getDictionary, localePath, resolveLocale, type Dictionary, type Locale } from "@/i18n";
import { formatEuro, formatWindow } from "@/lib/format";
import { depositOf } from "@/lib/pricing";
import { formatDay } from "@/lib/time";
import { loadPaymentLedger } from "@/server/integrations";
import type { OrderSummary } from "@/server/ports";

export async function generateMetadata({ params }: PageProps<"/[lang]/bestellung/danke">): Promise<Metadata> {
  const lang = await resolveLocale(params);
  return { title: getDictionary(lang).meta.thanksTitle };
}

// Diese Seite zeigt nur an. Ob eine Bestellung bezahlt ist, entscheidet ausschließlich der
// Stripe-Webhook; hier wird der Status aus Supabase gelesen, nie gesetzt.
export default async function ThanksPage({ params, searchParams }: PageProps<"/[lang]/bestellung/danke">) {
  const lang = await resolveLocale(params);
  const t = getDictionary(lang).thanks;
  return (
    <main className="wrap status-page">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>
        {t.titleBefore}
        <span className="brush">{t.titleBrush}</span>
        {t.titleAfter}
      </h1>
      <Suspense fallback={<p className="lead">{t.loading}</p>}>
        <OrderDetails searchParams={searchParams} lang={lang} />
      </Suspense>
    </main>
  );
}

function statusText(order: OrderSummary, t: Dictionary["thanks"]) {
  const plan = order.fulfillment === "pickup" ? t.planPickup : t.planDelivery;
  if (order.paymentStatus === "paid") return t.paid(plan);
  if (order.paymentStatus === "processing") return t.processing(plan);
  if (order.paymentStatus === "pending") return t.pending;
  return t.problem;
}

async function OrderDetails({
  searchParams,
  lang,
}: Pick<PageProps<"/[lang]/bestellung/danke">, "searchParams"> & { lang: Locale }) {
  const dict = getDictionary(lang);
  const t = dict.thanks;
  const { session_id: sessionId } = await searchParams;
  const ledger = loadPaymentLedger();
  const order =
    typeof sessionId === "string" && sessionId.startsWith("cs_") && ledger
      ? await ledger.findOrderBySession(sessionId)
      : null;

  return (
    <>
      {order ? (
        <>
          <p className="lead">{statusText(order, t)}</p>
          <dl className="order-summary">
            <dt>{t.orderNumber}</dt>
            <dd>
              <strong>{order.orderNumber}</strong>
            </dd>
            <dt>{order.fulfillment === "pickup" ? t.pickup : t.delivery}</dt>
            <dd>
              {formatDay(order.deliveryDate, "long", lang)}, {formatWindow(order.slotStart, order.slotEnd, lang)}
              <br />
              {order.fulfillment === "pickup"
                ? `${pickupLocation.street}, ${pickupLocation.city}`
                : `${order.street}, ${order.postalCode}`}
            </dd>
            <dt>{t.ordered}</dt>
            <dd>
              {order.items.map((i) => (
                <span key={i.itemId} className="order-summary-line">
                  {i.quantity} × {i.name}
                </span>
              ))}
            </dd>
            <dt>{t.total}</dt>
            <dd>
              <strong>{formatEuro(order.totalCents, lang)}</strong>
              {depositOf(order.items) > 0 && (
                <span className="hint">{t.inclDeposit(formatEuro(depositOf(order.items), lang), depositLabel(lang))}</span>
              )}
            </dd>
          </dl>
        </>
      ) : (
        <p className="lead">{t.noOrder}</p>
      )}
      <p className="lead">{t.changes}</p>
      <div className="status-actions">
        {order && (order.paymentStatus === "paid" || order.paymentStatus === "processing") && (
          <Link href={localePath(lang, `/bestellung/verfolgen/${order.trackingToken}`)} className="btn btn-red">
            {t.track}
          </Link>
        )}
        <WhatsAppButton
          label={dict.buttons.whatsappWrite}
          text={order ? t.whatsappText(order.orderNumber) : undefined}
          lang={lang}
        />
        <Link href={localePath(lang, "/")} className="btn btn-ghost">
          {dict.buttons.backHome}
        </Link>
      </div>
    </>
  );
}
