import Image from "next/image";
import { depositLabel, drinkRules, itemText, type CatalogItem } from "@/config/menu";
import { fill, type Locale } from "@/i18n/config";
import { formatEuro } from "@/lib/format";

export type DrinkCardLabels = {
  bottleAlt: string;
  placeholderAlt: string;
  imageSoon: string;
  soldOut: string;
  gardenLemonade: string;
  glassBottle: string;
  plusDeposit: string;
};

/**
 * Getränkekarte für Startseite und Bestellformular. Preis und Pfand stehen getrennt (PAngV).
 * Die Aktion (Link, Button, Mengensteuerung) kommt als children von der jeweiligen Seite.
 * Texte kommen als Props, weil die Karte auch im Client-Formular steckt.
 */
export function DrinkCard({
  item,
  lang,
  labels,
  soldOut = false,
  selected = false,
  children,
}: {
  item: CatalogItem;
  lang: Locale;
  labels: DrinkCardLabels;
  soldOut?: boolean;
  selected?: boolean;
  children?: React.ReactNode;
}) {
  const text = itemText(item, lang);
  return (
    <div className="drink-card" data-selected={selected} data-sold-out={soldOut}>
      <div className="drink-media">
        {item.image ? (
          <Image
            src={item.image}
            alt={fill(labels.bottleAlt, { description: text.description, size: text.size ?? "" })}
            width={900}
            height={900}
            sizes="160px"
          />
        ) : (
          <div
            className="drink-placeholder"
            role="img"
            aria-label={fill(labels.placeholderAlt, { description: text.description })}
          >
            <span>{text.name}</span>
            <small>{labels.imageSoon}</small>
          </div>
        )}
        {soldOut && <span className="drink-sold-out">{labels.soldOut}</span>}
      </div>
      <div className="drink-body">
        <p className="drink-brand">
          {drinkRules.brand} {labels.gardenLemonade}
        </p>
        <h3>{text.name}</h3>
        <p className="hint">
          {text.size} · {labels.glassBottle}
        </p>
        <p className="drink-price">
          <strong>{formatEuro(item.priceCents, lang)}</strong>
          <span>
            {fill(labels.plusDeposit, {
              amount: formatEuro(item.depositCents ?? 0, lang),
              label: depositLabel(lang),
            })}
          </span>
        </p>
        {children}
      </div>
    </div>
  );
}
