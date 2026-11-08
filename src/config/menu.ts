// Produktkatalog von Lean's (Preise Stand 01.11.2026 vom Betreiber). Preise und Produkte werden
// ausschließlich hier gepflegt; der Server berechnet jeden Betrag aus diesen Werten.

export type CatalogItem = {
  id: string;
  kind: "menu" | "side" | "drink";
  number?: number;
  name: string;
  description: string;
  includes?: string;
  priceCents: number;
  strips: number;
  fries: number;
  // Im Menü enthaltene Dips, für die Produktionsübersicht im Admin.
  dips?: { worcester: number; ketchup: number };
  image?: string;
  // Nur Getränke: Flaschengröße und Pfand je Flasche. Pfand ist kein Umsatz und wird separat ausgewiesen.
  size?: string;
  depositCents?: number;
  // Englische Anzeigetexte für /en. Fehlt ein Feld, gilt der deutsche Text (z. B. Markennamen).
  en?: { name?: string; description?: string; includes?: string; size?: string };
};

/** Anzeigetexte eines Produkts in der gewünschten Sprache. Bestellungen speichern weiter `name` (deutsch). */
export function itemText(item: CatalogItem, lang: "de" | "en") {
  const en = lang === "en" ? item.en : undefined;
  return {
    name: en?.name ?? item.name,
    description: en?.description ?? item.description,
    includes: en?.includes ?? item.includes,
    size: en?.size ?? item.size,
  };
}

export const menus = [
  {
    id: "basic",
    kind: "menu",
    number: 1,
    name: "Basic",
    description: "5 Chicken Strips",
    includes: "inkl. Worcestershire Sauce",
    en: { includes: "incl. Worcestershire Sauce" },
    priceCents: 800,
    strips: 5,
    fries: 0,
    dips: { worcester: 1, ketchup: 0 },
    image: "/assets/menu/basic-2026-11.webp",
  },
  {
    id: "crunch-combo",
    kind: "menu",
    number: 2,
    name: "Crunch Combo",
    description: "5 Chicken Strips + Pommes",
    includes: "inkl. Worcestershire Sauce & Ketchup",
    en: { description: "5 Chicken Strips + Fries", includes: "incl. Worcestershire Sauce & Ketchup" },
    priceCents: 1000,
    strips: 5,
    fries: 1,
    dips: { worcester: 1, ketchup: 1 },
    image: "/assets/menu/crunch-combo-2026-11b.webp",
  },
  {
    id: "big-boy-box",
    kind: "menu",
    number: 3,
    name: "Big Boy Box",
    description: "10 Chicken Strips",
    includes: "inkl. 2× Worcestershire Sauce",
    en: { includes: "incl. 2× Worcestershire Sauce" },
    priceCents: 1400,
    strips: 10,
    fries: 0,
    dips: { worcester: 2, ketchup: 0 },
    image: "/assets/menu/big-boy-box-2026-11.webp",
  },
  {
    id: "family-pack",
    kind: "menu",
    number: 4,
    name: "Family Pack",
    description: "10 Chicken Strips + 2× Pommes",
    includes: "inkl. 2× Worcestershire Sauce & 2× Ketchup",
    en: { description: "10 Chicken Strips + 2× Fries", includes: "incl. 2× Worcestershire Sauce & 2× Ketchup" },
    priceCents: 1800,
    strips: 10,
    fries: 2,
    dips: { worcester: 2, ketchup: 2 },
    image: "/assets/menu/family-pack-2026-11.webp",
  },
] as const satisfies readonly CatalogItem[];

export const sides = [
  { id: "pommes", kind: "side", name: "Pommes", description: "Extra Portion", priceCents: 300, strips: 0, fries: 1, en: { name: "Fries", description: "Extra portion" } },
  { id: "worcester", kind: "side", name: "Worcestershire Sauce", description: "Lean's Signature Sauce", priceCents: 150, strips: 0, fries: 0 },
  { id: "ketchup", kind: "side", name: "Ketchup", description: "Extra Dip", priceCents: 100, strips: 0, fries: 0, en: { description: "Extra dip" } },
  { id: "mayo", kind: "side", name: "Mayo", description: "Extra Dip", priceCents: 100, strips: 0, fries: 0, en: { description: "Extra dip" } },
] as const satisfies readonly CatalogItem[];

// Getränke: zusätzliche Produkte, kein Bestandteil der Menüs. Preise und Pfand sind vorläufig
// (siehe drinkRules); Bestand und "ausverkauft" pflegt der Admin unter /admin/getraenke.
export const drinks = [
  {
    id: "brambacher-himbeere-zitrone",
    kind: "drink",
    name: "Himbeere-Zitrone",
    description: "Bad Brambacher Garten-Limonade Himbeere-Zitrone",
    // 3,50 € inkl. Pfand laut Betreiber (02.11.2026): 3,35 € + 0,15 € Mehrwegpfand.
    priceCents: 335,
    depositCents: 15,
    size: "0,5 l",
    strips: 0,
    fries: 0,
    image: "/assets/drinks/brambacher-himbeere-zitrone-0-5l-v2.webp",
    en: {
      name: "Raspberry-Lemon",
      description: "Bad Brambacher Garden Lemonade Raspberry-Lemon",
      size: "0.5 l",
    },
  },
  {
    id: "brambacher-pink-grapefruit",
    kind: "drink",
    name: "Pink Grapefruit",
    description: "Bad Brambacher Garten-Limonade Pink Grapefruit",
    // 3,50 € inkl. Pfand laut Betreiber (02.11.2026): 3,35 € + 0,15 € Mehrwegpfand.
    priceCents: 335,
    depositCents: 15,
    size: "0,5 l",
    strips: 0,
    fries: 0,
    image: "/assets/drinks/brambacher-pink-grapefruit-0-5l.webp",
    en: { description: "Bad Brambacher Garden Lemonade Pink Grapefruit", size: "0.5 l" },
  },
] as const satisfies readonly CatalogItem[];

export const drinkRules = {
  brand: "Bad Brambacher",
  // 0,5-l-Glas-Mehrwegflasche (Brunnen-Mehrweg, 0,15 €). Kunde zahlt 3,50 € inkl. Pfand (Betreiber, 02.11.2026).
  depositLabel: "Mehrwegpfand",
  depositLabelEn: "deposit",
  pricesConfirmed: true,
  depositConfirmed: true,
} as const;

/** Bezeichnung des Pfands in der gewünschten Sprache. */
export function depositLabel(lang: "de" | "en") {
  return lang === "en" ? drinkRules.depositLabelEn : drinkRules.depositLabel;
}

// Getränke sind erst bestellbar, wenn Preis und Pfand bestätigt sind. Zum Testen lokal oder in einer
// Vercel-Preview NEXT_PUBLIC_DRINKS_PREVIEW=1 setzen.
export function drinksEnabled() {
  return (drinkRules.pricesConfirmed && drinkRules.depositConfirmed) || process.env.NEXT_PUBLIC_DRINKS_PREVIEW === "1";
}
export const drinksPreliminary = !(drinkRules.pricesConfirmed && drinkRules.depositConfirmed);

export const catalog: readonly CatalogItem[] = [...menus, ...sides, ...drinks];
export type ItemId =
  | (typeof menus)[number]["id"]
  | (typeof sides)[number]["id"]
  | (typeof drinks)[number]["id"];
export type DrinkId = (typeof drinks)[number]["id"];
export const drinkIds = drinks.map((d) => d.id) as DrinkId[];
export const itemIds = catalog.map((i) => i.id) as [ItemId, ...ItemId[]];

export function findItem(id: string): CatalogItem | undefined {
  return catalog.find((i) => i.id === id);
}

export const orderRules = {
  minOrderCents: 1400,
  // Abholung hat keinen Lieferweg, deshalb kein Mindestbestellwert (ein Menü reicht).
  pickupMinOrderCents: 0,
  // Pro Position, damit Tippfehler wie 50 × Family Pack nicht durchrutschen.
  maxQuantityPerItem: 10,
  // Mindestens ein Menü pro Bestellung; Side Orders allein werden nicht geliefert.
  requireMenu: true,
} as const;

// Vorläufig. Vor Go-Live mit den tatsächlichen Zutaten und Lieferantenangaben abgleichen (LMIV).
export const allergens = {
  confirmed: false,
  entries: [
    {
      name: "Chicken Strips (Cornflakes-Panade)",
      list: ["Gluten (Weizen, Gerste)", "Ei", "Milch"],
      en: { name: "Chicken Strips (cornflake coating)", list: ["Gluten (wheat, barley)", "Egg", "Milk"] },
    },
    {
      name: "Pommes",
      list: ["keine deklarationspflichtigen Allergene (frittiert in Sonnenblumenöl)"],
      en: { name: "Fries", list: ["no allergens requiring declaration (fried in sunflower oil)"] },
    },
    {
      name: "Worcestershire Sauce",
      list: ["Fisch", "Gluten (Gerste)", "Sellerie"],
      en: { name: "Worcestershire Sauce", list: ["Fish", "Gluten (barley)", "Celery"] },
    },
    {
      name: "Ketchup",
      list: ["Sellerie (je nach Hersteller)"],
      en: { name: "Ketchup", list: ["Celery (depending on manufacturer)"] },
    },
    { name: "Mayo", list: ["Ei", "Senf"], en: { name: "Mayo", list: ["Egg", "Mustard"] } },
    {
      name: "Garten-Limonaden (Bad Brambacher)",
      list: ["keine deklarationspflichtigen Allergene laut Hersteller (prüfen)"],
      en: {
        name: "Garden lemonades (Bad Brambacher)",
        list: ["no allergens requiring declaration according to the manufacturer (to be checked)"],
      },
    },
  ],
} as const;
