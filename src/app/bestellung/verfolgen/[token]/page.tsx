import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatWindow } from "@/lib/format";
import { formatDay } from "@/lib/time";
import { loadTrackingStore } from "@/server/integrations";
import type { AdminOrder, FulfillmentStatus } from "@/server/ports";

export const metadata: Metadata = { title: "Bestellung verfolgen | Lean's Crispy Chicken", robots: { index: false } };

// Öffentliche Statusseite hinter einem nicht erratbaren Link (Mail, Danke-Seite, WhatsApp).
// Zeigt bewusst keine Adresse oder Telefonnummer, falls der Link weitergeleitet wird.
export default function TrackingPage({ params }: PageProps<"/bestellung/verfolgen/[token]">) {
  return (
    <main className="wrap status-page">
      <p className="eyebrow">Bestellung verfolgen</p>
      <Suspense fallback={<p className="lead">Status wird geladen …</p>}>
        <Tracking params={params} />
      </Suspense>
    </main>
  );
}

const steps: { status: FulfillmentStatus; label: string; text: string }[] = [
  { status: "NEW", label: "Bestellt", text: "Deine Bestellung ist bei uns eingegangen." },
  { status: "PREP", label: "In Zubereitung", text: "Deine Chicken Strips sind in der Fritteuse." },
  { status: "READY", label: "Fertig", text: "Alles ist verpackt und wartet aufs Rad." },
  { status: "OUT_FOR_DELIVERY", label: "Unterwegs", text: "Lean ist mit dem Rad auf dem Weg zu dir." },
  { status: "DELIVERED", label: "Geliefert", text: "Guten Appetit!" },
];

const time = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

function headline(order: AdminOrder) {
  if (order.paymentStatus === "refunded") return "Bestellung erstattet";
  if (order.fulfillmentStatus === "CANCELLED") return "Bestellung storniert";
  if (order.paymentStatus === "pending" || order.paymentStatus === "expired") return "Zahlung ausstehend";
  return steps.find((s) => s.status === order.fulfillmentStatus)?.label ?? "Bestellt";
}

async function Tracking({ params }: Pick<PageProps<"/bestellung/verfolgen/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const order = /^[a-f0-9]{32}$/.test(token) ? await loadTrackingStore()?.findByTrackingToken(token) : null;

  if (!order) {
    return (
      <>
        <h1>Nicht gefunden</h1>
        <p className="lead">Diesen Link kennen wir nicht. Schreib uns kurz auf WhatsApp, dann schauen wir nach.</p>
        <div className="status-actions">
          <WhatsAppButton label="WhatsApp schreiben" text="Hi Lean's, mein Verfolgungslink funktioniert nicht: " />
        </div>
      </>
    );
  }

  const stopped = order.fulfillmentStatus === "CANCELLED" || order.paymentStatus === "refunded";
  const unpaid = order.paymentStatus === "pending" || order.paymentStatus === "expired" || order.paymentStatus === "failed";
  const finished = stopped || order.fulfillmentStatus === "DELIVERED";
  const current = steps.findIndex((s) => s.status === order.fulfillmentStatus);

  return (
    <>
      <AutoRefresh seconds={20} active={!finished} />
      <h1>
        <span className="brush">{headline(order)}</span>
      </h1>
      <p className="lead">
        {order.orderNumber} · {formatDay(order.deliveryDate)}, {formatWindow(order.slotStart, order.slotEnd)}
      </p>

      {stopped ? (
        <p className="notice">
          Diese Bestellung wird nicht geliefert.
          {order.paymentStatus === "refunded" && " Der Betrag geht auf dein Zahlungsmittel zurück, das dauert ein paar Tage."}
        </p>
      ) : unpaid ? (
        <p className="notice">Sobald die Zahlung eingegangen ist, siehst du hier, wie weit deine Bestellung ist.</p>
      ) : (
        <ol className="tracking-steps">
          {steps.map((step, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            const at =
              step.status === "OUT_FOR_DELIVERY" ? order.outForDeliveryAt : step.status === "DELIVERED" ? order.deliveredAt : null;
            return (
              <li key={step.status} className={state} aria-current={state === "current" ? "step" : undefined}>
                <strong>
                  {step.label}
                  {at && <small> · {time.format(new Date(at))} Uhr</small>}
                </strong>
                {state === "current" && <span>{step.text}</span>}
              </li>
            );
          })}
        </ol>
      )}

      <p className="order-summary-line" style={{ marginTop: 20 }}>
        {order.items.map((i) => `${i.quantity}× ${i.name}`).join(" · ")}
      </p>
      {!finished && <p className="hint">Die Seite aktualisiert sich automatisch.</p>}
      <div className="status-actions">
        <WhatsAppButton label="Frage zur Bestellung" text={`Hi Lean's, zu meiner Bestellung ${order.orderNumber}: `} />
      </div>
    </>
  );
}
