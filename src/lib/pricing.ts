import { catalog, orderRules, type CatalogItem, type ItemId } from "@/config/menu";

export type CartInput = Partial<Record<ItemId, number>>;

export type PricedLine = {
  itemId: ItemId;
  kind: CatalogItem["kind"];
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  strips: number;
  fries: number;
};

export type PricedCart = {
  lines: PricedLine[];
  menuCount: number;
  strips: number;
  fries: number;
  totalCents: number;
  meetsMinimum: boolean;
  missingCents: number;
  hasMenu: boolean;
};

/** Einzige Stelle, an der Beträge entstehen. Läuft auf dem Server und als Vorschau im Client. */
export function priceCart(cart: CartInput): PricedCart {
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
      strips: quantity * item.strips,
      fries: quantity * item.fries,
    });
  }
  const sum = (pick: (l: PricedLine) => number) => lines.reduce((n, l) => n + pick(l), 0);
  const totalCents = sum((l) => l.lineTotalCents);
  const menuCount = sum((l) => (l.kind === "menu" ? l.quantity : 0));
  return {
    lines,
    menuCount,
    strips: sum((l) => l.strips),
    fries: sum((l) => l.fries),
    totalCents,
    meetsMinimum: totalCents >= orderRules.minOrderCents,
    missingCents: Math.max(0, orderRules.minOrderCents - totalCents),
    hasMenu: menuCount > 0,
  };
}
