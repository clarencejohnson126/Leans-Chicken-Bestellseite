"use client";

import { useActionState, useState } from "react";
import { createWhatsAppOrderAction } from "@/app/admin/actions";
import { CopyButton } from "@/components/copy-button";
import { business, whatsappTo } from "@/config/business";
import { catalog, type ItemId } from "@/config/menu";
import { schedule, deliveryArea } from "@/config/schedule";
import { formatEuro } from "@/lib/format";
import { priceCart, type CartInput } from "@/lib/pricing";

export type AdminDayOption = {
  date: string;
  label: string;
  slots: { id: string; start: string; end: string; open: boolean; remainingStrips: number }[];
};

function paymentMessage(firstName: string, orderNumber: string, total: string, url: string) {
  return [
    `Hi ${firstName}, danke für deine Bestellung bei ${business.name}!`,
    `Bestellung ${orderNumber} · ${total}`,
    `Hier kannst du bezahlen (Karte, Apple Pay, Google Pay oder SEPA): ${url}`,
    `Der Link ist ${schedule.whatsappHoldMinutes} Minuten gültig, so lange halten wir dir den Platz frei.`,
  ].join("\n");
}

export function WhatsAppOrderForm({ days }: { days: AdminDayOption[] }) {
  const [state, action, pending] = useActionState(createWhatsAppOrderAction, null);
  const [cart, setCart] = useState<CartInput>({});
  const preview = priceCart(cart);
  const fields = state && !state.ok ? (state.fields ?? {}) : {};
  const error = (name: string) => fields[name] && <span className="field-error">{fields[name]}</span>;

  if (state?.ok) {
    const message = paymentMessage(state.firstName, state.orderNumber, state.total, state.checkoutUrl);
    return (
      <div className="admin-window">
        <h2>Bestellung {state.orderNumber} angelegt</h2>
        <p className="lead">
          {state.total} · Platz ist {schedule.whatsappHoldMinutes} Minuten reserviert. Schick dem Kunden jetzt den
          Zahlungslink.
        </p>
        <div className="admin-order-actions">
          <a className="btn btn-whatsapp" href={whatsappTo(state.phone, message)} target="_blank" rel="noreferrer">
            In WhatsApp senden
          </a>
          <CopyButton text={message} label="Nachricht kopieren" />
          <CopyButton text={state.checkoutUrl} label="Nur Link kopieren" />
        </div>
        <p className="hint" style={{ marginTop: 16 }}>
          Sobald bezahlt ist, steht die Bestellung automatisch im Dashboard und im Sheet.{" "}
          <a href="/admin/whatsapp">Nächste WhatsApp-Bestellung</a>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="admin-whatsapp-form">
      <section className="admin-window">
        <h2>Bestellung</h2>
        {catalog.map((item) => (
          <label key={item.id} className="admin-qty">
            <span>
              {item.name} <small>{formatEuro(item.priceCents)}</small>
            </span>
            <input
              type="number"
              name={`item_${item.id}`}
              min={0}
              max={10}
              inputMode="numeric"
              placeholder="0"
              onChange={(e) =>
                setCart((c) => ({ ...c, [item.id as ItemId]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
              }
            />
          </label>
        ))}
        {error("items")}
        <p className="admin-production">
          {preview.strips} Strips · <b>{formatEuro(preview.totalCents)}</b>
          {!preview.meetsMinimum &&
            preview.totalCents > 0 &&
            ` · noch ${formatEuro(preview.missingCents)} bis zum Mindestbestellwert`}
        </p>
      </section>

      <section className="admin-window">
        <h2>Lieferzeit</h2>
        <div className="field">
          <select name="slotId" required defaultValue="" aria-label="Lieferfenster">
            <option value="" disabled>
              Fenster wählen …
            </option>
            {days.map((d) => (
              <optgroup key={d.date} label={d.label}>
                {d.slots.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.open || s.remainingStrips < Math.max(1, preview.strips)}>
                    {s.start}–{s.end} Uhr · {s.open ? `${s.remainingStrips} Strips frei` : "Bestellschluss"}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {error("slotId")}
        </div>
      </section>

      <section className="admin-window">
        <h2>Kunde</h2>
        <div className="field">
          <label htmlFor="wa-name">Name</label>
          <input id="wa-name" name="name" required autoComplete="off" />
          {error("customer.name")}
        </div>
        <div className="field">
          <label htmlFor="wa-phone">WhatsApp-Nummer</label>
          <input id="wa-phone" name="phone" type="tel" required placeholder="0176 …" autoComplete="off" />
          {error("customer.phone")}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="wa-street">Straße und Hausnummer</label>
            <input id="wa-street" name="street" required autoComplete="off" />
            {error("customer.street")}
          </div>
          <div className="field">
            <label htmlFor="wa-plz">PLZ</label>
            <input id="wa-plz" name="postalCode" required defaultValue={deliveryArea.postalCodes[0]} inputMode="numeric" />
            {error("customer.postalCode")}
          </div>
        </div>
        <div className="field">
          <label htmlFor="wa-company">
            Firma <small>optional</small>
          </label>
          <input id="wa-company" name="company" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="wa-address-note">
            Hinweis zur Adresse <small>optional</small>
          </label>
          <input id="wa-address-note" name="addressNote" placeholder="z. B. 3. OG, Klingel Müller" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="wa-note">
            Notiz <small>optional</small>
          </label>
          <textarea id="wa-note" name="note" />
        </div>
      </section>

      {state && !state.ok && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-red" disabled={pending} style={{ marginTop: 16 }}>
        {pending ? "Wird angelegt …" : "Bestellung anlegen und Zahlungslink erzeugen"}
      </button>
    </form>
  );
}
