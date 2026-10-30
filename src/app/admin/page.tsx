import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { logoutAction, setPausedAction, setStatusAction } from "@/app/admin/actions";
import { findItem } from "@/config/menu";
import { schedule } from "@/config/schedule";
import { formatEuro, formatWindow } from "@/lib/format";
import { listDeliveryDays } from "@/lib/slots";
import { addDays, formatDay, isoWeekday, localParts } from "@/lib/time";
import { requireAdmin } from "@/server/admin-auth";
import { loadAdminStore } from "@/server/integrations";
import type { AdminOrder, FulfillmentStatus } from "@/server/ports";

export const metadata: Metadata = { title: "Admin | Lean's Crispy Chicken", robots: { index: false } };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="wrap admin-page">
      <Suspense fallback={<p className="lead">Dashboard wird geladen …</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const statusLabel: Record<FulfillmentStatus, string> = {
  NEW: "Neu",
  PREP: "In Zubereitung",
  READY: "Fertig",
  OUT_FOR_DELIVERY: "Unterwegs",
  DELIVERED: "Geliefert",
  CANCELLED: "Storniert",
};

// Ein Button für den jeweils nächsten Schritt, damit es mittags mit einer Hand geht.
const nextStep: Partial<Record<FulfillmentStatus, { to: FulfillmentStatus; label: string }>> = {
  NEW: { to: "PREP", label: "Zubereiten" },
  PREP: { to: "READY", label: "Fertig" },
  READY: { to: "OUT_FOR_DELIVERY", label: "Losfahren" },
  OUT_FOR_DELIVERY: { to: "DELIVERED", label: "Geliefert" },
};

const paymentLabel: Partial<Record<AdminOrder["paymentStatus"], string>> = {
  pending: "Zahlung offen",
  processing: "SEPA eingereicht",
  failed: "Zahlung fehlgeschlagen",
  refunded: "Erstattet",
};

/** Bestellungen, die produziert und geliefert werden: bezahlt oder SEPA eingereicht, nicht storniert. */
function isActive(o: AdminOrder) {
  return (o.paymentStatus === "paid" || o.paymentStatus === "processing") && o.fulfillmentStatus !== "CANCELLED";
}

function production(orders: AdminOrder[]) {
  const counts = new Map<string, number>();
  let strips = 0;
  let fries = 0;
  const sauces = { "Worcestershire Sauce": 0, Ketchup: 0, Mayo: 0 };
  for (const order of orders.filter(isActive)) {
    strips += order.strips;
    for (const line of order.items) {
      const item = findItem(line.itemId);
      fries += (item?.fries ?? 0) * line.quantity;
      if (item?.kind === "menu") {
        counts.set(line.name, (counts.get(line.name) ?? 0) + line.quantity);
        // Jedes Menü enthält Worcestershire Sauce, die Pommes-Menüs zusätzlich Ketchup.
        sauces["Worcestershire Sauce"] += line.quantity;
        if (item.fries) sauces.Ketchup += line.quantity;
      }
      if (line.itemId === "worcester") sauces["Worcestershire Sauce"] += line.quantity;
      if (line.itemId === "ketchup") sauces.Ketchup += line.quantity;
      if (line.itemId === "mayo") sauces.Mayo += line.quantity;
    }
  }
  return { counts: [...counts], strips, fries, sauces: Object.entries(sauces).filter(([, n]) => n > 0) };
}

function defaultDay(today: string) {
  for (let i = 0; i < 8; i++) {
    const date = addDays(today, i);
    if ((schedule.deliveryWeekdays as readonly number[]).includes(isoWeekday(date))) return date;
  }
  return today;
}

async function Dashboard({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await connection();
  const admin = await requireAdmin();
  const store = loadAdminStore();
  if (!store) return <p className="notice error">Supabase ist nicht konfiguriert.</p>;

  const now = new Date();
  const today = localParts(now).date;
  const { tag } = await searchParams;
  const day = typeof tag === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tag) ? tag : defaultDay(today);
  const dayTabs = [...new Set([today, ...listDeliveryDays(now).map((d) => d.date), day])].sort();

  const [orders, paused] = await Promise.all([store.ordersForDate(day), store.ordersPaused()]);
  const active = orders.filter(isActive);
  const total = active.reduce((n, o) => n + o.totalCents, 0);
  const windows = schedule.windows.map((w) => ({
    ...w,
    orders: orders.filter((o) => o.slotStart === w.start),
  }));

  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">Admin · {admin.email}</p>
          <h1 className="admin-title">{formatDay(day)}</h1>
        </div>
        <div className="admin-top-actions">
          <form action={setPausedAction}>
            <input type="hidden" name="paused" value={paused ? "false" : "true"} />
            <button type="submit" className={`btn ${paused ? "btn-red" : "btn-ghost"}`}>
              {paused ? "Bestellungen pausiert – fortsetzen" : "Bestellungen pausieren"}
            </button>
          </form>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost">
              Logout
            </button>
          </form>
        </div>
      </div>

      <nav className="admin-days" aria-label="Liefertag wählen">
        {dayTabs.map((d) => (
          <Link key={d} href={`/admin?tag=${d}`} className={d === day ? "active" : undefined}>
            {d === today ? "Heute" : formatDay(d, "short")}
          </Link>
        ))}
      </nav>

      <section className="admin-stats">
        <div>
          <b>{active.length}</b> Bestellungen
        </div>
        <div>
          <b>{active.reduce((n, o) => n + o.strips, 0)}</b> Strips
        </div>
        <div>
          <b>{formatEuro(total)}</b> Umsatz
        </div>
      </section>

      {windows.map((w) => {
        const p = production(w.orders);
        return (
          <section key={w.start} className="admin-window">
            <header>
              <h2>{formatWindow(w.start, w.end)}</h2>
              <span className="admin-capacity">
                {p.strips} / {schedule.maxStripsPerWindow} Strips
              </span>
            </header>
            {p.strips > 0 && (
              <p className="admin-production">
                {p.counts.map(([name, n]) => `${n}× ${name}`).join(" · ")}
                {p.fries > 0 && ` · ${p.fries}× Pommes`}
                {p.sauces.length > 0 && <br />}
                {p.sauces.map(([name, n]) => `${n}× ${name}`).join(" · ")}
              </p>
            )}
            {w.orders.length === 0 ? (
              <p className="hint">Keine Bestellungen.</p>
            ) : (
              <ul className="admin-orders">
                {w.orders.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

function OrderCard({ order: o }: { order: AdminOrder }) {
  const step = nextStep[o.fulfillmentStatus];
  const address = `${o.street}, ${o.postalCode} Mannheim`;
  return (
    <li className={`admin-order status-${o.fulfillmentStatus.toLowerCase()} ${isActive(o) ? "" : "inactive"}`}>
      <div className="admin-order-head">
        <strong>{o.orderNumber}</strong>
        <span className="admin-badge">{statusLabel[o.fulfillmentStatus]}</span>
        {paymentLabel[o.paymentStatus] && (
          <span className={`admin-badge pay-${o.paymentStatus}`}>{paymentLabel[o.paymentStatus]}</span>
        )}
        {o.source === "whatsapp" && <span className="admin-badge">WhatsApp</span>}
      </div>
      <p className="admin-order-items">
        {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")} · <b>{formatEuro(o.totalCents)}</b>
      </p>
      <p className="admin-order-customer">
        {o.customerName}
        {o.company && ` (${o.company})`} ·{" "}
        <a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
          {o.street}
        </a>
        {o.addressNote && <> · {o.addressNote}</>}
      </p>
      {o.customerNote && <p className="admin-order-note">„{o.customerNote}“</p>}
      <div className="admin-order-actions">
        <a className="btn btn-ghost" href={`tel:${o.customerPhone}`}>
          Anrufen
        </a>
        {step && isActive(o) && (
          <form action={setStatusAction}>
            <input type="hidden" name="orderId" value={o.id} />
            <input type="hidden" name="status" value={step.to} />
            <button type="submit" className="btn btn-red">
              {step.label}
            </button>
          </form>
        )}
        {o.fulfillmentStatus !== "CANCELLED" && o.fulfillmentStatus !== "DELIVERED" && (
          <form action={setStatusAction}>
            <input type="hidden" name="orderId" value={o.id} />
            <input type="hidden" name="status" value="CANCELLED" />
            <button type="submit" className="btn-link">
              Stornieren
            </button>
          </form>
        )}
        {o.fulfillmentStatus === "CANCELLED" && (
          <form action={setStatusAction}>
            <input type="hidden" name="orderId" value={o.id} />
            <input type="hidden" name="status" value="NEW" />
            <button type="submit" className="btn-link">
              Wiederherstellen
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
