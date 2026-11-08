import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { pickupLocation, pilot, pilotDates } from "@/config/business";
import { lang as rootLang } from "next/root-params";
import { getDictionary, localePath, resolveRootLocale, type Dictionary, type Locale } from "@/i18n";
import { formatWindow } from "@/lib/format";
import { formatDay } from "@/lib/time";
import { loadTrackingStore } from "@/server/integrations";
import type { AdminOrder, FulfillmentStatus } from "@/server/ports";

// Sprache über next/root-params: Der Token ist erst zur Anfragezeit bekannt, die Sprache schon beim
// Prerendern. So bleibt die Seitenhülle statisch und nur der Status streamt in der Suspense-Grenze.
export async function generateMetadata(): Promise<Metadata> {
  const lang = resolveRootLocale(await rootLang());
  return { title: getDictionary(lang).meta.trackingTitle, robots: { index: false } };
}

// Öffentliche Statusseite hinter einem nicht erratbaren Link (Mail, Danke-Seite, WhatsApp).
// Zeigt bewusst keine Adresse oder Telefonnummer, falls der Link weitergeleitet wird.
export default async function TrackingPage({ params }: PageProps<"/[lang]/bestellung/verfolgen/[token]">) {
  const lang = resolveRootLocale(await rootLang());
  const t = getDictionary(lang).tracking;
  return (
    <main className="wrap status-page">
      <p className="eyebrow">{t.eyebrow}</p>
      <Suspense fallback={<p className="lead">{t.loading}</p>}>
        <Tracking params={params} lang={lang} />
      </Suspense>
    </main>
  );
}

type Step = { status: FulfillmentStatus; label: string; text: string };

function stepsFor(order: AdminOrder, t: Dictionary["tracking"]): Step[] {
  const s = t.steps;
  if (order.fulfillment === "pickup") {
    return [
      { status: "NEW", ...s.ordered },
      { status: "PREP", ...s.prep },
      { status: "READY", label: s.pickupReady.label, text: s.pickupReady.text(pickupLocation.street, pickupLocation.city) },
      { status: "DELIVERED", ...s.pickedUp },
    ];
  }
  return [
    { status: "NEW", ...s.ordered },
    { status: "PREP", ...s.prep },
    { status: "READY", ...s.ready },
    { status: "OUT_FOR_DELIVERY", ...s.out },
    { status: "DELIVERED", ...s.delivered },
  ];
}

const time = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

function headline(order: AdminOrder, t: Dictionary["tracking"]) {
  if (order.paymentStatus === "refunded") return t.refunded;
  if (order.fulfillmentStatus === "CANCELLED") return t.cancelled;
  if (order.paymentStatus === "pending" || order.paymentStatus === "expired") return t.paymentPending;
  return stepsFor(order, t).find((s) => s.status === order.fulfillmentStatus)?.label ?? t.steps.ordered.label;
}

async function Tracking({
  params,
  lang,
}: Pick<PageProps<"/[lang]/bestellung/verfolgen/[token]">, "params"> & { lang: Locale }) {
  await connection();
  const dict = getDictionary(lang);
  const t = dict.tracking;
  const { token } = await params;
  const order = /^[a-f0-9]{32}$/.test(token) ? await loadTrackingStore()?.findByTrackingToken(token) : null;

  if (!order) {
    return (
      <>
        <h1>{t.notFoundTitle}</h1>
        <p className="lead">{t.notFoundText}</p>
        <div className="status-actions">
          <WhatsAppButton label={dict.buttons.whatsappWrite} text={t.notFoundWhatsapp} lang={lang} />
        </div>
      </>
    );
  }

  const stopped = order.fulfillmentStatus === "CANCELLED" || order.paymentStatus === "refunded";
  const unpaid = order.paymentStatus === "pending" || order.paymentStatus === "expired" || order.paymentStatus === "failed";
  const finished = stopped || order.fulfillmentStatus === "DELIVERED";
  const orderSteps = stepsFor(order, t);
  const current = orderSteps.findIndex((s) => s.status === order.fulfillmentStatus);
  const dates = pilotDates(lang);

  return (
    <>
      <AutoRefresh seconds={20} active={!finished} />
      <h1>
        <span className="brush">{headline(order, t)}</span>
      </h1>
      <p className="lead">
        {order.orderNumber} · {order.fulfillment === "pickup" ? t.pickup : t.delivery}{" "}
        {formatDay(order.deliveryDate, "long", lang)}, {formatWindow(order.slotStart, order.slotEnd, lang)}
      </p>

      {stopped ? (
        <p className="notice">
          {t.stopped}
          {order.paymentStatus === "refunded" && t.refundedNote}
        </p>
      ) : unpaid ? (
        <p className="notice">{t.unpaid}</p>
      ) : (
        <ol className="tracking-steps">
          {orderSteps.map((step, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            const at =
              step.status === "OUT_FOR_DELIVERY" ? order.outForDeliveryAt : step.status === "DELIVERED" ? order.deliveredAt : null;
            return (
              <li key={step.status} className={state} aria-current={state === "current" ? "step" : undefined}>
                <strong>
                  {step.label}
                  {at && (
                    <small>
                      {" "}
                      · {time.format(new Date(at))}
                      {t.timeSuffix}
                    </small>
                  )}
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
      {!finished && <p className="hint">{t.autoRefresh}</p>}
      {order.fulfillmentStatus === "DELIVERED" && (
        <p className="notice" style={{ marginTop: 20 }}>
          {t.feedback(pilot.label, dates.endLabel)}
          <Link href={localePath(lang, pilot.surveyPath)}>{t.feedbackLink}</Link>
        </p>
      )}
      <div className="status-actions">
        <WhatsAppButton label={t.question} text={t.whatsappText(order.orderNumber)} lang={lang} />
      </div>
    </>
  );
}
