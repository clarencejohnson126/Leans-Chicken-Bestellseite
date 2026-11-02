import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { setDrinkStockAction } from "@/app/admin/actions";
import { drinkEconomics, drinkMarginCents } from "@/config/economics";
import { drinkRules, drinks, drinksEnabled } from "@/config/menu";
import { formatEuro } from "@/lib/format";
import { requireAdmin } from "@/server/admin-auth";
import { loadOrderDeps } from "@/server/integrations";

export const metadata: Metadata = { title: "Getränke | Lean's Crispy Chicken", robots: { index: false } };

export default function DrinksAdminPage() {
  return (
    <main className="wrap admin-page">
      <p className="eyebrow">
        <Link href="/admin">← Dashboard</Link>
      </p>
      <h1 className="admin-title">Getränke</h1>
      <Suspense fallback={<p className="hint">Bestand wird geladen …</p>}>
        <Stock />
      </Suspense>
    </main>
  );
}

async function Stock() {
  await connection();
  await requireAdmin();
  const deps = loadOrderDeps();
  if (!deps) return <p className="notice error">Supabase ist nicht konfiguriert.</p>;
  const stock = await deps.store.drinkStock();

  return (
    <>
      {!drinksEnabled() && (
        <p className="notice">
          Getränke sind auf der Website noch <b>nicht sichtbar</b>.{" "}
          {!drinkRules.pricesConfirmed && "Preise sind noch nicht bestätigt. "}
          {!drinkRules.depositConfirmed && "Das Pfand ist noch nicht bestätigt. "}
          Freigabe in <code>src/config/menu.ts</code> (drinkRules).
        </p>
      )}
      <p className="lead">
        „Noch verkaufbar“ ist die Zahl der Flaschen, die ab jetzt online verkauft werden dürfen. Bezahlte und gerade
        reservierte Bestellungen sind schon abgezogen. Bei 0 oder ohne Haken steht die Sorte auf „Ausverkauft“.
      </p>
      {drinks.map((item) => {
        const s = stock.find((x) => x.itemId === item.id);
        return (
          <section key={item.id} className="admin-window">
            <header>
              <h2>
                {item.name} <small>{item.size}</small>
              </h2>
              <span className="admin-capacity">
                {s ? (s.remaining > 0 ? `${s.remaining} frei` : "Ausverkauft") : "kein Bestand angelegt"}
              </span>
            </header>
            <p className="hint">
              {s?.committed ?? 0} Flaschen in bezahlten oder reservierten Bestellungen · {formatEuro(item.priceCents)} +{" "}
              {formatEuro(item.depositCents)} {drinkRules.depositLabel}
            </p>
            <form action={setDrinkStockAction} className="admin-stock-form">
              <input type="hidden" name="itemId" value={item.id} />
              <label className="field">
                <span>Noch verkaufbar (Flaschen)</span>
                <input type="number" name="remaining" min={0} max={9999} defaultValue={s?.remaining ?? 0} inputMode="numeric" />
              </label>
              <label className="check">
                <input type="checkbox" name="available" defaultChecked={s?.available ?? false} />
                <span>Im Verkauf</span>
              </label>
              <button type="submit" className="btn btn-red">
                Speichern
              </button>
            </form>
          </section>
        );
      })}

      <section className="admin-window">
        <h2>Kalkulation je Flasche (vorläufig)</h2>
        <ul className="admin-calc">
          <li>Verkaufspreis ohne Pfand: {formatEuro(drinks[0].priceCents)}</li>
          <li>Einkaufspreis ohne Pfand: {formatEuro(drinkEconomics.purchaseCents)}</li>
          <li>
            Umsatzsteuer:{" "}
            {drinkEconomics.vatRate ? `${drinkEconomics.vatRate * 100} % (Getränke)` : "keine (Kleinunternehmer § 19 UStG)"}
          </li>
          <li>Zahlungsgebühr (Anteil, ca. {drinkEconomics.paymentFeeRate * 100} % auf Preis + Pfand)</li>
          <li>
            <b>Deckungsbeitrag: {formatEuro(drinkMarginCents(drinks[0].priceCents, drinks[0].depositCents))}</b>
          </li>
        </ul>
        <p className="hint">
          Pfand ist durchlaufender Posten: Ihr zahlt es dem Händler und gebt es dem Kunden bei Rückgabe zurück. Es
          zählt im Dashboard nicht zum Umsatz.
        </p>
      </section>
    </>
  );
}
