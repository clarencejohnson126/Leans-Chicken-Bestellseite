// Gleicht den Stripe-Produktkatalog mit src/config/menu.ts ab. Idempotent: beliebig oft ausführbar.
// Aufruf: npm run stripe:catalog   (liest STRIPE_SECRET_KEY aus .env.local, nur sk_test_ erlaubt)
//
// Jedes Katalog-Item wird ein Stripe-Produkt mit fester ID "leans_<item_id>" und einem Preis mit
// lookup_key "leans_<item_id>". Ändert sich ein Preis in menu.ts, entsteht ein neuer Stripe-Preis,
// der den lookup_key übernimmt; der alte wird archiviert. Stripe-Preise sind unveränderlich.
import Stripe from "stripe";
import { catalog, type CatalogItem } from "../src/config/menu.ts";
import { stripeProductId } from "../src/lib/stripe-ids.ts";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_") && process.env.ALLOW_LIVE !== "1") {
  console.error("STRIPE_SECRET_KEY fehlt oder ist kein Test-Key (sk_test_). Abbruch.");
  process.exit(1);
}

const stripe = new Stripe(key);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const imageBase = siteUrl.startsWith("https://") ? siteUrl : null;

function productId(item: CatalogItem) {
  return stripeProductId(item.id);
}

function productData(item: CatalogItem) {
  const description = [item.description, item.includes].filter(Boolean).join(" · ");
  return {
    name: item.kind === "menu" ? `${item.number}. ${item.name}` : item.name,
    description,
    ...(imageBase && item.image ? { images: [new URL(item.image, imageBase).toString()] } : {}),
    metadata: {
      item_id: item.id,
      kind: item.kind,
      strips: String(item.strips),
      fries: String(item.fries),
    },
  };
}

async function syncItem(item: CatalogItem) {
  const id = productId(item);
  const data = productData(item);

  let product: Stripe.Product;
  try {
    product = await stripe.products.update(id, { ...data, active: true });
  } catch (error) {
    if ((error as { code?: string }).code !== "resource_missing") throw error;
    product = await stripe.products.create({ id, ...data });
  }

  const existing = await stripe.prices.list({ lookup_keys: [id], limit: 1 });
  const current = existing.data[0];
  if (current?.unit_amount === item.priceCents && current.currency === "eur" && current.active) {
    if (product.default_price !== current.id) await stripe.products.update(id, { default_price: current.id });
    return `= ${id} ${item.priceCents} ct`;
  }

  const price = await stripe.prices.create({
    product: id,
    currency: "eur",
    unit_amount: item.priceCents,
    lookup_key: id,
    transfer_lookup_key: true,
    metadata: { item_id: item.id },
  });
  await stripe.products.update(id, { default_price: price.id });
  if (current) await stripe.prices.update(current.id, { active: false });
  return `${current ? "~" : "+"} ${id} ${item.priceCents} ct`;
}

for (const item of catalog) {
  console.log(await syncItem(item));
}

// Produkte, die es in menu.ts nicht mehr gibt, werden archiviert (nicht gelöscht).
const known = new Set(catalog.map(productId));
for await (const product of stripe.products.list({ active: true, limit: 100 })) {
  if (product.id.startsWith("leans_") && !known.has(product.id)) {
    await stripe.products.update(product.id, { active: false });
    console.log(`- ${product.id} archiviert`);
  }
}
