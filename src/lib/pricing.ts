import { catalog, orderRules, type CatalogItem, type ItemId } from "@/config/menu";

export type CartInput = Partial<Record<ItemId, number>>;

export type FulfillmentType = "delivery" | "pickup";

export function minOrderCents(fulfillment: FulfillmentType) {
  return fulfillment === "pickup" ? orderRules.pickupMinOrderCents : orderRules.minOrderCents;
}

export type PricedLine = {
  itemId: ItemId;
  kind: CatalogItem["kind"];
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  /** Pfand je Stück (nur Getränke), nicht im lineTotalCents enthalten. */
  unitDepositCents: number;
  strips: number;
  fries: number;
};

export type PricedCart = {
  lines: PricedLine[];
  menuCount: number;
  strips: number;
  fries: number;
  bottles: number;
  /** Warenwert ohne Pfand. Zählt für den Mindestbestellwert. */
  goodsCents: number;
  depositCents: number;
  /** Was der Kunde zahlt: Warenwert + Pfand. */
  totalCents: number;
  meetsMinimum: boolean;
  missingCents: number;
  hasMenu: boolean;
};

/** Pfand aller Positionen einer gespeicherten Bestellung. */
export function depositOf(items: { depositCents: number }[]) {
  return items.reduce((n, i) => n + i.depositCents, 0);
}

/** Einzige Stelle, an der Beträge entstehen. Läuft auf dem Server und als Vorschau im Client. */
export function priceCart(cart: CartInput, fulfillment: FulfillmentType = "delivery"): PricedCart {
  const lines: PricedLine[] = [];
  for (const item of catalog) {
    const quantity = cart[item.id as ItemId] ?? 0;
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`Ungültige Menge für ${item.id}`);
    }
    if (quantity === 0) continue;
    lines.push({
      itemId: item.id as ItemId,
      kind: item.kind,
      name: item.name,
      quantity,
      unitPriceCents: item.priceCents,
      lineTotalCents: quantity * item.priceCents,
      unitDepositCents: item.depositCents ?? 0,
      strips: quantity * item.strips,
      fries: quantity * item.fries,
    });
  }
  const sum = (pick: (l: PricedLine) => number) => lines.reduce((n, l) => n + pick(l), 0);
  const goodsCents = sum((l) => l.lineTotalCents);
  const depositCents = sum((l) => l.quantity * l.unitDepositCents);
  const menuCount = sum((l) => (l.kind === "menu" ? l.quantity : 0));
  return {
    lines,
    menuCount,
    strips: sum((l) => l.strips),
    fries: sum((l) => l.fries),
    bottles: sum((l) => (l.kind === "drink" ? l.quantity : 0)),
    goodsCents,
    depositCents,
    totalCents: goodsCents + depositCents,
    meetsMinimum: goodsCents >= minOrderCents(fulfillment),
    missingCents: Math.max(0, minOrderCents(fulfillment) - goodsCents),
    hasMenu: menuCount > 0,
  };
}
