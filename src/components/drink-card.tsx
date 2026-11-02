import Image from "next/image";
import { drinkRules, type CatalogItem } from "@/config/menu";
import { formatEuro } from "@/lib/format";

/**
 * Getränkekarte für Startseite und Bestellformular. Preis und Pfand stehen getrennt (PAngV).
 * Die Aktion (Link, Button, Mengensteuerung) kommt als children von der jeweiligen Seite.
 */
export function DrinkCard({
  item,
  soldOut = false,
  selected = false,
  children,
}: {
  item: CatalogItem;
  soldOut?: boolean;
  selected?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="drink-card" data-selected={selected} data-sold-out={soldOut}>
      <div className="drink-media">
        {item.image ? (
          <Image src={item.image} alt={`${item.description}, ${item.size} Flasche`} width={900} height={900} sizes="160px" />
        ) : (
          <div className="drink-placeholder" role="img" aria-label={`${item.description}, Produktbild folgt`}>
            <span>{item.name}</span>
            <small>Bild folgt</small>
          </div>
        )}
        {soldOut && <span className="drink-sold-out">Ausverkauft</span>}
      </div>
      <div className="drink-body">
        <p className="drink-brand">{drinkRules.brand} Garten-Limonade</p>
        <h3>{item.name}</h3>
        <p className="hint">{item.size} · Glasflasche</p>
        <p className="drink-price">
          <strong>{formatEuro(item.priceCents)}</strong>
          <span>
            zzgl. {formatEuro(item.depositCents ?? 0)} {drinkRules.depositLabel}
          </span>
        </p>
        {children}
      </div>
    </div>
  );
}
