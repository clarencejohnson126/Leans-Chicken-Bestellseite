"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DrinkCard, type DrinkCardLabels } from "@/components/drink-card";
import { MenuImage } from "@/components/menu-image";
import { pickupLocation, pilot, pilotDates, whatsappLink } from "@/config/business";
import { depositLabel, drinks, itemText, menus, orderRules, sides, type CatalogItem, type ItemId } from "@/config/menu";
import { deliveryArea } from "@/config/schedule";
import type { Dictionary } from "@/i18n/de";
import { fill, localePath, type Locale } from "@/i18n/config";
import { formatEuro, formatWindow } from "@/lib/format";
import { priceCart, type FulfillmentType } from "@/lib/pricing";
import { orderRequestSchemaFor, type OrderRequestInput } from "@/lib/validation";

type Labels = Dictionary["orderForm"];

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

/** Freie Flaschen je Getränk; null, solange Getränke nicht freigegeben sind. */
export type DrinkAvailability = Partial<Record<ItemId, number>> | null;

export function OrderForm({
  days,
  drinkStock = null,
  initialItems = {},
  lang,
  labels: t,
  drinkLabels,
  menuImageLabels,
}: {
  days: DayOption[];
  drinkStock?: DrinkAvailability;
  initialItems?: Partial<Record<ItemId, number>>;
  lang: Locale;
  labels: Labels;
  drinkLabels: DrinkCardLabels & { addToCart: string };
  menuImageLabels: { zoom: string; close: string };
}) {
  const euro = (cents: number) => formatEuro(cents, lang);
  const firstOpenDay = days.find((d) => d.slots.some((s) => s.open && s.remainingStrips > 0));
  const [quantities, setQuantities] = useState<Partial<Record<ItemId, number>>>(initialItems);
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

  const maxFor = (id: ItemId) => Math.min(orderRules.maxQuantityPerItem, drinkStock?.[id] ?? orderRules.maxQuantityPerItem);

  function changeQuantity(id: ItemId, delta: number) {
    setQuantities((q) => {
      const next = Math.min(maxFor(id), Math.max(0, (q[id] ?? 0) + delta));
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
      lang,
    };
    const parsed = orderRequestSchemaFor(lang).safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      setNotice({ tone: "error", message: t.checkMarked });
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
        message: data.message ?? t.genericError,
        alternative: data.alternative,
        whatsapp: res.status === 503 || res.status >= 500,
      });
    } catch {
      setNotice({
        tone: "error",
        message: t.offline,
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

  const wa = whatsappLink(undefined, lang);
  const canSubmit = cart.hasMenu && cart.meetsMinimum && slotId && !slotTooSmall && acceptTerms && !submitting;

  return (
    <form onSubmit={submit} noValidate>
      <div className="order-grid">
        <section className="card span" aria-labelledby="step-food">
          <div className="card-title">
            <span>1</span>
            <h2 id="step-food">{t.stepFood}</h2>
          </div>
          <div className="menu-grid">
            {menus.map((item) => {
              const text = itemText(item, lang);
              return (
                <div className="menu-card" key={item.id} data-selected={(quantities[item.id] ?? 0) > 0}>
                  <MenuImage
                    src={item.image}
                    alt={`${text.name}: ${text.description}`}
                    sizes="(min-width: 960px) 520px, 90vw"
                    labels={menuImageLabels}
                  />
                  <div className="menu-card-body">
                    <div>
                      <h3>
                        <span className="menu-no">{item.number}</span> {text.name}
                      </h3>
                      <p className="menu-desc">{text.description}</p>
                      <p className="hint">{text.includes}</p>
                    </div>
                    <div className="menu-card-foot">
                      <strong className="menu-price">{euro(item.priceCents)}</strong>
                      <Stepper item={item} lang={lang} labels={t} qty={quantities[item.id] ?? 0} onChange={changeQuantity} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {drinkStock && cart.hasMenu && cart.bottles === 0 && (
            <div className="drink-upsell">
              <p>
                <strong>{t.upsell}</strong>
              </p>
              <div className="drink-upsell-actions">
                {drinks
                  .filter((d) => (drinkStock[d.id] ?? 0) > 0)
                  .map((d) => (
                    <button type="button" key={d.id} className="btn btn-ghost" onClick={() => changeQuantity(d.id, 1)}>
                      + {itemText(d, lang).name}, {itemText(d, lang).size} · {euro(d.priceCents)}
                    </button>
                  ))}
              </div>
              <p className="hint">
                {fill(t.upsellHint, { amount: euro(drinks[0].depositCents), label: depositLabel(lang) })}
              </p>
            </div>
          )}
          <h3 className="sides-title">{t.sides}</h3>
          {sides.map((item) => {
            const text = itemText(item, lang);
            return (
              <div className="sauce-row" key={item.id}>
                <div>
                  <strong>{text.name}</strong>
                  <div className="hint">
                    {text.description} · {euro(item.priceCents)}
                  </div>
                </div>
                <Stepper item={item} lang={lang} labels={t} qty={quantities[item.id] ?? 0} onChange={changeQuantity} />
              </div>
            );
          })}
          {drinkStock && (
            <div className="drinks-block" id="drinks">
              <h3 className="sides-title">{t.drinks}</h3>
              <p className="hint">{t.drinksHint}</p>
              <div className="drink-grid">
                {drinks.map((item) => {
                  const qty = quantities[item.id] ?? 0;
                  const soldOut = (drinkStock[item.id] ?? 0) <= 0;
                  return (
                    <DrinkCard
                      key={item.id}
                      item={item}
                      lang={lang}
                      labels={drinkLabels}
                      soldOut={soldOut}
                      selected={qty > 0}
                    >
                      {soldOut ? null : qty === 0 ? (
                        <button type="button" className="btn btn-red drink-add" onClick={() => changeQuantity(item.id, 1)}>
                          {t.addToCart}
                        </button>
                      ) : (
                        <Stepper
                          item={item}
                          lang={lang}
                          labels={t}
                          qty={qty}
                          max={maxFor(item.id)}
                          onChange={changeQuantity}
                        />
                      )}
                    </DrinkCard>
                  );
                })}
              </div>
            </div>
          )}
          {errors.items && <p className="field-error">{errors.items}</p>}
          {cart.lines.length > 0 && !cart.hasMenu && (
            <p className="notice" style={{ marginTop: 14 }}>
              {t.sidesNeedMenu}
            </p>
          )}
          {cart.hasMenu && !cart.meetsMinimum && (
            <div className="notice" style={{ marginTop: 14 }}>
              <p>
                {fill(t.minOrderBefore, { min: euro(orderRules.minOrderCents), missing: euro(cart.missingCents) })}
                {cart.depositCents > 0 && t.minOrderDeposit}
                {t.minOrderAfter}
              </p>
              <button type="button" className="btn btn-ghost" onClick={() => setFulfillment("pickup")}>
                {t.preferPickup}
              </button>
            </div>
          )}
        </section>

        <section className="card span" aria-labelledby="step-time">
          <div className="card-title">
            <span>2</span>
            <h2 id="step-time">{t.stepTime}</h2>
          </div>
          <div className="day-tabs fulfillment-tabs" role="group" aria-label={t.fulfillmentLabel}>
            <button type="button" className="day-tab" aria-pressed={!pickup} onClick={() => setFulfillment("delivery")}>
              {t.delivery}
              <small>{fill(t.deliveryFree, { amount: euro(orderRules.minOrderCents) })}</small>
            </button>
            <button type="button" className="day-tab" aria-pressed={pickup} onClick={() => setFulfillment("pickup")}>
              {t.pickup}
              <small>{t.pickupNoMin}</small>
            </button>
          </div>
          {pickup && (
            <p className="hint" style={{ marginBottom: 14 }}>
              {t.pickupAt}{" "}
              <b>
                {pickupLocation.street}, {pickupLocation.city}
              </b>
            </p>
          )}
          {days[0]?.date === pilot.startsOn && (
            <p className="hint" style={{ marginBottom: 14 }}>
              {t.startNoticeBefore}
              <b>{pilotDates(lang).startLabel}</b>
              {t.startNoticeAfter}
            </p>
          )}
          {days.length === 0 ? (
            <p className="hint">{t.noDays}</p>
          ) : (
            <>
              <div className="day-tabs" role="group" aria-label={t.dayLabel}>
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
                      <small>{anyOpen ? t.dayOpen : t.dayClosed}</small>
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <div className="slot-grid" role="group" aria-label={fill(t.slotsLabel, { day: selectedDay.label })}>
                  {selectedDay.slots.map((s) => {
                    const fits = s.remainingStrips >= Math.max(1, cart.strips);
                    const disabled = !s.open || !fits;
                    const status = !s.open
                      ? t.slotClosed
                      : s.remainingStrips === 0
                        ? t.slotFull
                        : !fits
                          ? t.slotTooSmall
                          : s.remainingStrips <= 15
                            ? t.slotAlmostFull
                            : t.slotAvailable;
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
                        {formatWindow(s.start, s.end, lang)}
                        <small>{status}</small>
                      </button>
                    );
                  })}
                </div>
              )}
              {errors.slotId && <p className="field-error">{errors.slotId}</p>}
              {slotTooSmall && (
                <p className="notice" style={{ marginTop: 14 }}>
                  {t.slotTooSmallNotice}
                </p>
              )}
              <p className="hint" style={{ marginTop: 14 }}>
                {t.orderDeadline}
              </p>
            </>
          )}
        </section>

        <section className="card span" aria-labelledby="step-address">
          <div className="card-title">
            <span>3</span>
            <h2 id="step-address">{pickup ? t.stepContact : t.stepAddress}</h2>
          </div>
          <p className="hint">
            {pickup
              ? fill(t.pickupHint, { address: `${pickupLocation.street}, ${pickupLocation.city}` })
              : fill(t.deliveryHint, { area: deliveryArea.label })}
          </p>
          <Field label={t.name} name="customer.name" errors={errors}>
            <input
              id="customer.name"
              autoComplete="name"
              value={customer.name}
              onChange={(e) => updateCustomer("name", e.target.value)}
            />
          </Field>
          <Field label={t.phone} hint={t.phoneHint} name="customer.phone" errors={errors}>
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
                <Field label={t.street} name="customer.street" errors={errors}>
                  <input
                    id="customer.street"
                    autoComplete="street-address"
                    value={customer.street}
                    onChange={(e) => updateCustomer("street", e.target.value)}
                  />
                </Field>
                <Field label={t.postalCode} name="customer.postalCode" errors={errors}>
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
                <Field label={t.company} hint={t.optional} name="customer.company" errors={errors}>
                  <input
                    id="customer.company"
                    autoComplete="organization"
                    value={customer.company}
                    onChange={(e) => updateCustomer("company", e.target.value)}
                  />
                </Field>
                <Field label={t.addressNote} hint={t.optional} name="customer.addressNote" errors={errors}>
                  <input
                    id="customer.addressNote"
                    value={customer.addressNote}
                    onChange={(e) => updateCustomer("addressNote", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}
          <Field label={t.note} hint={t.optional} name="note" errors={errors}>
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
              {t.termsBefore}
              <Link href={localePath(lang, "/agb")} target="_blank">
                {t.termsLink}
              </Link>
              {t.termsMiddle}
              <Link href={localePath(lang, "/datenschutz")} target="_blank">
                {t.privacyLink}
              </Link>
              {t.termsAfter}
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
                  {fill(t.takeAlternative, { time: notice.alternative.start })}
                </button>
              )}
              {notice.whatsapp && wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                  {t.whatsappOrder}
                </a>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="summary-bar">
        <div className="wrap summary-inner">
          <div className="summary-total">
            <strong>{euro(cart.totalCents)}</strong>
            <span>
              {fill(t.strips, { count: cart.strips })}
              {cart.bottles > 0 && ` · ${cart.bottles} ${cart.bottles === 1 ? t.drinkOne : t.drinkMany}`} ·{" "}
              {pickup ? t.summaryPickup : t.summaryDelivery}
              {cart.depositCents > 0 && ` · ${fill(t.summaryDeposit, { amount: euro(cart.depositCents) })}`}
            </span>
          </div>
          <button type="submit" className="btn btn-red" disabled={!canSubmit}>
            {submitting ? t.submitting : t.submit}
          </button>
        </div>
      </div>
    </form>
  );
}

function Stepper({
  item,
  lang,
  labels,
  qty,
  max = orderRules.maxQuantityPerItem,
  onChange,
}: {
  item: CatalogItem;
  lang: Locale;
  labels: Pick<Labels, "remove" | "count" | "add">;
  qty: number;
  max?: number;
  onChange: (id: ItemId, delta: number) => void;
}) {
  const id = item.id as ItemId;
  const name = itemText(item, lang).name;
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(id, -1)} disabled={qty === 0} aria-label={fill(labels.remove, { name })}>
        −
      </button>
      <output aria-live="polite" aria-label={fill(labels.count, { name })}>
        {qty}
      </output>
      <button
        type="button"
        className="plus"
        onClick={() => onChange(id, 1)}
        disabled={qty >= max}
        aria-label={fill(labels.add, { name })}
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
