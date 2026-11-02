import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { pickupLocation } from "@/config/business";
import { drinkRules } from "@/config/menu";
import { formatEuro, formatWindow } from "@/lib/format";
import { depositOf } from "@/lib/pricing";
import { formatDay } from "@/lib/time";
import { loadPaymentLedger } from "@/server/integrations";
import type { OrderSummary } from "@/server/ports";

export const metadata: Metadata = { title: "Danke! | Lean's Crispy Chicken" };

// Diese Seite zeigt nur an. Ob eine Bestellung bezahlt ist, entscheidet ausschließlich der
// Stripe-Webhook; hier wird der Status aus Supabase gelesen, nie gesetzt.
export default function ThanksPage({ searchParams }: PageProps<"/bestellung/danke">) {
  return (
    <main className="wrap status-page">
      <p className="eyebrow">Bestellung</p>
      <h1>
        Danke für deine <span className="brush">Bestellung</span>!
      </h1>
      <Suspense fallback={<p className="lead">Bestellung wird geladen …</p>}>
        <OrderDetails searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function statusText(order: OrderSummary) {
  const plan = order.fulfillment === "pickup" ? "Deine Bestellung liegt in deinem Zeitfenster bereit." : "Wir liefern in deinem Zeitfenster.";
  if (order.paymentStatus === "paid") return `Bezahlt. ${plan}`;
  if (order.paymentStatus === "processing") return `SEPA-Lastschrift eingereicht. ${plan} Die Abbuchung folgt in den nächsten Tagen.`;
  if (order.paymentStatus === "pending") {
    return "Deine Zahlung wird gerade bestätigt. Das dauert meist nur ein paar Sekunden – lade die Seite gleich neu.";
  }
  return "Bei deiner Zahlung gab es ein Problem. Schreib uns kurz auf WhatsApp.";
}

async function OrderDetails({ searchParams }: Pick<PageProps<"/bestellung/danke">, "searchParams">) {
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
          <p className="lead">{statusText(order)}</p>
          <dl className="order-summary">
            <dt>Bestellnummer</dt>
            <dd>
              <strong>{order.orderNumber}</strong>
            </dd>
            <dt>{order.fulfillment === "pickup" ? "Abholung" : "Lieferung"}</dt>
            <dd>
              {formatDay(order.deliveryDate)}, {formatWindow(order.slotStart, order.slotEnd)}
              <br />
              {order.fulfillment === "pickup"
                ? `${pickupLocation.street}, ${pickupLocation.city}`
                : `${order.street}, ${order.postalCode}`}
            </dd>
            <dt>Bestellt</dt>
            <dd>
              {order.items.map((i) => (
                <span key={i.itemId} className="order-summary-line">
                  {i.quantity} × {i.name}
                </span>
              ))}
            </dd>
            <dt>Summe</dt>
            <dd>
              <strong>{formatEuro(order.totalCents)}</strong>
              {depositOf(order.items) > 0 && (
                <span className="hint"> inkl. {formatEuro(depositOf(order.items))} {drinkRules.depositLabel}</span>
              )}
            </dd>
          </dl>
        </>
      ) : (
        <p className="lead">
          Du bekommst deine Zahlungsbestätigung per E-Mail. Deine Bestellung ist in deinem gewählten Zeitfenster fertig.
        </p>
      )}
      <p className="lead">Änderungen? Schreib uns auf WhatsApp.</p>
      <div className="status-actions">
        {order && (order.paymentStatus === "paid" || order.paymentStatus === "processing") && (
          <Link href={`/bestellung/verfolgen/${order.trackingToken}`} className="btn btn-red">
            Bestellung verfolgen
          </Link>
        )}
        <WhatsAppButton
          label="WhatsApp schreiben"
          text={order ? `Hi Lean's, zu meiner Bestellung ${order.orderNumber}: ` : undefined}
        />
        <Link href="/" className="btn btn-ghost">
          Zur Startseite
        </Link>
      </div>
    </>
  );
}
