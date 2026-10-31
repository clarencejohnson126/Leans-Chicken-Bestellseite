"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { pickupLocation, whatsappLink } from "@/config/business";
import { menus, orderRules, sides, type CatalogItem, type ItemId } from "@/config/menu";
import { deliveryArea } from "@/config/schedule";
import { formatEuro, formatWindow } from "@/lib/format";
import { priceCart, type FulfillmentType } from "@/lib/pricing";
import { orderRequestSchema, type OrderRequestInput } from "@/lib/validation";

export type SlotOption = {
  id: string;
  start: string;
  end: string;
  open: boolean;
  remainingStrips: number;
};

export type DayOption = {
  date: string;
  label: string;
  shortLabel: string;
  slots: SlotOption[];
};

type Notice = {
  tone: "info" | "error";
  message: string;
  alternative?: { id: string; date: string; start: string; end: string };
  whatsapp?: boolean;
};

const emptyCustomer = {
  name: "",
  phone: "",
  company: "",
  street: "",
  postalCode: deliveryArea.postalCodes[0],
  addressNote: "",
};

export function OrderForm({ days }: { days: DayOption[] }) {
  const firstOpenDay = days.find((d) => d.slots.some((s) => s.open && s.remainingStrips > 0));
  const [quantities, setQuantities] = useState<Partial<Record<ItemId, number>>>({});
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("delivery");
  const [day, setDay] = useState(firstOpenDay?.date ?? days[0]?.date ?? "");
  const [slotId, setSlotId] = useState("");
  const [customer, setCustomer] = useState(emptyCustomer);
  const [note, setNote] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cart = useMemo(() => priceCart(quantities, fulfillment), [quantities, fulfillment]);
  const pickup = fulfillment === "pickup";
  const selectedDay = days.find((d) => d.date === day);
  const selectedSlot = days.flatMap((d) => d.slots).find((s) => s.id === slotId);
  const slotTooSmall = selectedSlot ? selectedSlot.remainingStrips < cart.strips : false;

  function clearError(key: string) {
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function changeQuantity(id: ItemId, delta: number) {
    setQuantities((q) => {
      const next = Math.min(orderRules.maxQuantityPerItem, Math.max(0, (q[id] ?? 0) + delta));
      return { ...q, [id]: next };
    });
    clearError("items");
  }

  function updateCustomer(field: keyof typeof emptyCustomer, value: string) {
    setCustomer((c) => ({ ...c, [field]: value }));
    clearError(`customer.${field}`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    const payload: OrderRequestInput = {
      items: quantities,
      fulfillment,
      slotId,
      customer,
      note,
      acceptTerms: acceptTerms as true,
    };
    const parsed = orderRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      setNotice({ tone: "error", message: "Bitte prüfe die markierten Angaben." });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      if (data.fields) setErrors(data.fields);
      setNotice({
        tone: res.status === 503 ? "info" : "error",
        message: data.message ?? "Da ist etwas schiefgelaufen. Bitte versuch es nochmal.",
        alternative: data.alternative,
        whatsapp: res.status === 503 || res.status >= 500,
      });
    } catch {
      setNotice({
        tone: "error",
        message: "Keine Verbindung. Bitte prüfe dein Internet und versuch es nochmal.",
        whatsapp: true,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function takeAlternative(id: string, date: string) {
    setDay(date);
    setSlotId(id);
    setNotice(null);
  }

  const wa = whatsappLink();
  const canSubmit = cart.hasMenu && cart.meetsMinimum && slotId && !slotTooSmall && acceptTerms && !submitting;

  return (
    <form onSubmit={submit} noValidate>
      <div className="order-grid">
        <section className="card span" aria-labelledby="step-food">
          <div className="card-title">
            <span>1</span>
            <h2 id="step-food">Dein Menü</h2>
          </div>
          <div className="menu-grid">
            {menus.map((item) => (
              <div className="menu-card" key={item.id} data-selected={(quantities[item.id] ?? 0) > 0}>
                <Image
                  src={item.image}
                  alt={`${item.name}: ${item.description}`}
                  width={709}
                  height={390}
                  sizes="(min-width: 960px) 520px, 90vw"
                />
                <div className="menu-card-body">
                  <div>
                    <h3>
                      <span className="menu-no">{item.number}</span> {item.name}
                    </h3>
                    <p className="menu-desc">{item.description}</p>
                    <p className="hint">{item.includes}</p>
                  </div>
                  <div className="menu-card-foot">
                    <strong className="menu-price">{formatEuro(item.priceCents)}</strong>
                    <Stepper item={item} qty={quantities[item.id] ?? 0} onChange={changeQuantity} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <h3 className="sides-title">Side Orders</h3>
          {sides.map((item) => (
            <div className="sauce-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <div className="hint">
                  {item.description} · {formatEuro(item.priceCents)}
                </div>
              </div>
              <Stepper item={item} qty={quantities[item.id] ?? 0} onChange={changeQuantity} />
            </div>
          ))}
          {errors.items && <p className="field-error">{errors.items}</p>}
          {cart.lines.length > 0 && !cart.hasMenu && (
            <p className="notice" style={{ marginTop: 14 }}>
              Side Orders liefern wir nur zusammen mit mindestens einem Menü.
            </p>
          )}
          {cart.hasMenu && !cart.meetsMinimum && (
            <div className="notice" style={{ marginTop: 14 }}>
              <p>
                Mindestbestellwert für die Lieferung {formatEuro(orderRules.minOrderCents)}. Noch{" "}
                {formatEuro(cart.missingCents)} bis zur Lieferung, oder du holst ab, dann gibt es keinen
                Mindestbestellwert.
              </p>
              <button type="button" className="btn btn-ghost" onClick={() => setFulfillment("pickup")}>
                Lieber abholen
              </button>
            </div>
          )}
        </section>

        <section className="card span" aria-labelledby="step-time">
          <div className="card-title">
            <span>2</span>
            <h2 id="step-time">Lieferung oder Abholung</h2>
          </div>
          <div className="day-tabs fulfillment-tabs" role="group" aria-label="Lieferung oder Abholung">
            <button type="button" className="day-tab" aria-pressed={!pickup} onClick={() => setFulfillment("delivery")}>
              Lieferung
              <small>gratis ab {formatEuro(orderRules.minOrderCents)}</small>
            </button>
            <button type="button" className="day-tab" aria-pressed={pickup} onClick={() => setFulfillment("pickup")}>
              Abholung
              <small>ohne Mindestbestellwert</small>
            </button>
          </div>
          {pickup && (
            <p className="hint" style={{ marginBottom: 14 }}>
              Abholen bei uns:{" "}
              <b>
                {pickupLocation.street}, {pickupLocation.city}
              </b>
            </p>
          )}
          {days.length === 0 ? (
            <p className="hint">Aktuell sind keine Liefertage geplant.</p>
          ) : (
            <>
              <div className="day-tabs" role="group" aria-label="Liefertag">
                {days.map((d) => {
                  const anyOpen = d.slots.some((s) => s.open && s.remainingStrips > 0);
                  return (
                    <button
                      type="button"
                      key={d.date}
                      className="day-tab"
                      aria-pressed={d.date === day}
                      disabled={!anyOpen}
                      onClick={() => setDay(d.date)}
                    >
                      {d.shortLabel}
                      <small>{anyOpen ? "bestellbar" : "geschlossen"}</small>
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <div className="slot-grid" role="group" aria-label={`Lieferfenster am ${selectedDay.label}`}>
                  {selectedDay.slots.map((s) => {
                    const fits = s.remainingStrips >= Math.max(1, cart.strips);
                    const disabled = !s.open || !fits;
                    const status = !s.open
                      ? "Bestellschluss"
                      : s.remainingStrips === 0
                        ? "ausgebucht"
                        : !fits
                          ? "zu wenig frei für deine Menge"
                          : s.remainingStrips <= 15
                            ? "fast ausgebucht"
                            : "verfügbar";
                    return (
                      <button
                        type="button"
                        key={s.id}
                        className="slot"
                        aria-pressed={s.id === slotId}
                        disabled={disabled}
                        onClick={() => {
                          setSlotId(s.id);
                          clearError("slotId");
                        }}
                      >
                        {formatWindow(s.start, s.end)}
                        <small>{status}</small>
                      </button>
                    );
                  })}
                </div>
              )}
              {errors.slotId && <p className="field-error">{errors.slotId}</p>}
              {slotTooSmall && (
                <p className="notice" style={{ marginTop: 14 }}>
                  Für deine Menge ist in diesem Fenster nicht mehr genug frei. Bitte wähle eine andere Zeit.
                </p>
              )}
              <p className="hint" style={{ marginTop: 14 }}>
                Bestellschluss jeweils 60 Minuten vor Beginn des Zeitfensters.
              </p>
            </>
          )}
        </section>

        <section className="card span" aria-labelledby="step-address">
          <div className="card-title">
            <span>3</span>
            <h2 id="step-address">{pickup ? "Kontakt" : "Lieferadresse & Kontakt"}</h2>
          </div>
          <p className="hint">
            {pickup
              ? `Du holst ab: ${pickupLocation.street}, ${pickupLocation.city}.`
              : `Wir liefern nur auf ${deliveryArea.label}.`}
          </p>
          <Field label="Name" name="customer.name" errors={errors}>
            <input
              id="customer.name"
              autoComplete="name"
              value={customer.name}
              onChange={(e) => updateCustomer("name", e.target.value)}
            />
          </Field>
          <Field label="Mobilnummer" hint="für Rückfragen zur Bestellung" name="customer.phone" errors={errors}>
            <input
              id="customer.phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0162 1234567"
              value={customer.phone}
              onChange={(e) => updateCustomer("phone", e.target.value)}
            />
          </Field>
          {!pickup && (
            <>
              <div className="field-row">
                <Field label="Straße und Hausnummer" name="customer.street" errors={errors}>
                  <input
                    id="customer.street"
                    autoComplete="street-address"
                    value={customer.street}
                    onChange={(e) => updateCustomer("street", e.target.value)}
                  />
                </Field>
                <Field label="PLZ" name="customer.postalCode" errors={errors}>
                  <input
                    id="customer.postalCode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={5}
                    value={customer.postalCode}
                    onChange={(e) => updateCustomer("postalCode", e.target.value)}
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field label="Firma / Gebäude" hint="optional" name="customer.company" errors={errors}>
                  <input
                    id="customer.company"
                    autoComplete="organization"
                    value={customer.company}
                    onChange={(e) => updateCustomer("company", e.target.value)}
                  />
                </Field>
                <Field label="Etage, Klingel" hint="optional" name="customer.addressNote" errors={errors}>
                  <input
                    id="customer.addressNote"
                    value={customer.addressNote}
                    onChange={(e) => updateCustomer("addressNote", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}
          <Field label="Anmerkung" hint="optional" name="note" errors={errors}>
            <textarea id="note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <label className="check" style={{ marginTop: 22 }}>
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                clearError("acceptTerms");
              }}
            />
            <span>
              Ich akzeptiere die{" "}
              <Link href="/agb" target="_blank">
                AGB
              </Link>{" "}
              und habe die{" "}
              <Link href="/datenschutz" target="_blank">
                Datenschutzerklärung
              </Link>{" "}
              gelesen. Bei frisch zubereiteten Speisen besteht kein Widerrufsrecht.
            </span>
          </label>
          {errors.acceptTerms && <p className="field-error">{errors.acceptTerms}</p>}

          {notice && (
            <div className={`notice ${notice.tone === "error" ? "error" : ""}`} role="alert" style={{ marginTop: 20 }}>
              <p>{notice.message}</p>
              {notice.alternative && (
                <button
                  type="button"
                  className="btn btn-red"
                  onClick={() => takeAlternative(notice.alternative!.id, notice.alternative!.date)}
                >
                  Nächste freie Zeit: {notice.alternative.start} Uhr übernehmen
                </button>
              )}
              {notice.whatsapp && wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                  Über WhatsApp bestellen
                </a>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="summary-bar">
        <div className="wrap summary-inner">
          <div className="summary-total">
            <strong>{formatEuro(cart.totalCents)}</strong>
            <span>
              {cart.strips} Strips · {pickup ? "Abholung" : "Lieferung gratis"}
            </span>
          </div>
          <button type="submit" className="btn btn-red" disabled={!canSubmit}>
            {submitting ? "Einen Moment…" : "Zur Bezahlung"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Stepper({
  item,
  qty,
  onChange,
}: {
  item: CatalogItem;
  qty: number;
  onChange: (id: ItemId, delta: number) => void;
}) {
  const id = item.id as ItemId;
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(id, -1)} disabled={qty === 0} aria-label={`${item.name} entfernen`}>
        −
      </button>
      <output aria-live="polite" aria-label={`Anzahl ${item.name}`}>
        {qty}
      </output>
      <button
        type="button"
        className="plus"
        onClick={() => onChange(id, 1)}
        disabled={qty >= orderRules.maxQuantityPerItem}
        aria-label={`${item.name} hinzufügen`}
      >
        +
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  name,
  errors,
  children,
}: {
  label: string;
  hint?: string;
  name: string;
  errors: Record<string, string>;
  children: React.ReactNode;
}) {
  const error = errors[name];
  return (
    <div className="field" data-invalid={Boolean(error)}>
      <label htmlFor={name}>
        {label} {hint && <small>({hint})</small>}
      </label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
