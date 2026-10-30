import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatEuro, formatWindow } from "@/lib/format";
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

const statusText: Partial<Record<OrderSummary["paymentStatus"], string>> = {
  paid: "Bezahlt. Wir liefern in deinem Zeitfenster mit dem Fahrrad.",
  processing: "SEPA-Lastschrift eingereicht. Wir liefern wie geplant, die Abbuchung folgt in den nächsten Tagen.",
  pending: "Deine Zahlung wird gerade bestätigt. Das dauert meist nur ein paar Sekunden – lade die Seite gleich neu.",
};

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
          <p className="lead">{statusText[order.paymentStatus] ?? "Bei deiner Zahlung gab es ein Problem. Schreib uns kurz auf WhatsApp."}</p>
          <dl className="order-summary">
            <dt>Bestellnummer</dt>
            <dd>
              <strong>{order.orderNumber}</strong>
            </dd>
            <dt>Lieferung</dt>
            <dd>
              {formatDay(order.deliveryDate)}, {formatWindow(order.slotStart, order.slotEnd)}
              <br />
              {order.street}, {order.postalCode}
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
            </dd>
          </dl>
        </>
      ) : (
        <p className="lead">
          Du bekommst deine Zahlungsbestätigung per E-Mail. Wir liefern in deinem gewählten Zeitfenster mit dem
          Fahrrad.
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
