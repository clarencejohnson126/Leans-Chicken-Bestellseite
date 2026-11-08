import { z } from "zod";
import { drinkIds, drinksEnabled, itemIds, menus, orderRules, type ItemId } from "@/config/menu";
import { deliveryArea } from "@/config/schedule";
import { defaultLocale, isLocale, locales, type Locale } from "@/i18n/config";
import { orderMessages } from "@/i18n/order-messages";

/** Normalisiert Telefonnummern auf E.164 (+49… als Standard). Gibt null zurück, wenn ungültig. */
export function normalizePhone(raw: string): string | null {
  let n = raw.replace(/[\s()/.-]/g, "");
  if (n.startsWith("00")) n = `+${n.slice(2)}`;
  else if (n.startsWith("0")) n = `+49${n.slice(1)}`;
  else if (!n.startsWith("+")) n = `+49${n}`;
  return /^\+[1-9]\d{8,14}$/.test(n) ? n : null;
}

const menuQuantity = (items: Partial<Record<ItemId, number>>) =>
  menus.reduce((n, m) => n + (items[m.id] ?? 0), 0);

const text = (max: number) => z.string().trim().max(max);

/** Sprache der Bestellung (Website /en oder /). Fehlt sie, gilt Deutsch. */
export const langSchema = z.enum(locales).optional().default(defaultLocale);

/** Liest die Sprache aus einem beliebigen Request-Body, ohne den Rest zu prüfen. */
export function requestLocale(body: unknown): Locale {
  const lang = (body as { lang?: unknown } | null)?.lang;
  return isLocale(lang) ? lang : defaultLocale;
}

function buildSchemas(lang: Locale) {
  const m = orderMessages[lang];

  const quantity = z.number().int().min(0).max(orderRules.maxQuantityPerItem, m.maxQuantity(orderRules.maxQuantityPerItem));

  const itemsSchema = z
    .object(
      Object.fromEntries(itemIds.map((id) => [id, quantity.optional()])) as Record<
        ItemId,
        z.ZodOptional<typeof quantity>
      >,
    )
    .strict()
    .refine((items) => !orderRules.requireMenu || menuQuantity(items) > 0, m.requireMenu)
    .refine((items) => drinksEnabled() || drinkIds.every((id) => !items[id]), m.drinksDisabled);

  const customerSchema = z.object({
    name: text(80).min(2, m.name),
    phone: z
      .string()
      .trim()
      .transform((v, ctx) => {
        const n = normalizePhone(v);
        if (!n) {
          ctx.addIssue({ code: "custom", message: m.phone });
          return z.NEVER;
        }
        return n;
      }),
    company: text(80).optional().default(""),
    // Adresse wird nur bei Lieferung geprüft (siehe orderRequestSchema).
    street: text(120).optional().default(""),
    postalCode: z.string().trim().optional().default(""),
    addressNote: text(160).optional().default(""),
  });

  const orderRequestSchema = z
    .object({
      items: itemsSchema,
      fulfillment: z.enum(["delivery", "pickup"]).optional().default("delivery"),
      slotId: z.string().regex(/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/, m.slot),
      customer: customerSchema,
      note: text(300).optional().default(""),
      acceptTerms: z.literal(true, m.acceptTerms),
      lang: langSchema,
    })
    .superRefine((order, ctx) => {
      if (order.fulfillment !== "delivery") return;
      if (order.customer.street.length < 3) {
        ctx.addIssue({ code: "custom", path: ["customer", "street"], message: m.street });
      }
      if (!(deliveryArea.postalCodes as readonly string[]).includes(order.customer.postalCode)) {
        ctx.addIssue({
          code: "custom",
          path: ["customer", "postalCode"],
          message: m.postalCode(deliveryArea.label, deliveryArea.postalCodes.join(", ")),
        });
      }
    })
    // Bei Abholung keine Adresse speichern, auch wenn das Formular noch eine enthält.
    .transform((order) =>
      order.fulfillment === "pickup"
        ? { ...order, customer: { ...order.customer, street: "", postalCode: "", addressNote: "" } }
        : order,
    );

  return { itemsSchema, customerSchema, orderRequestSchema };
}

const schemas = { de: buildSchemas("de"), en: buildSchemas("en") } as const;

/** Bestell-Schema mit Fehlermeldungen in der gewünschten Sprache. */
export function orderRequestSchemaFor(lang: Locale) {
  return schemas[lang].orderRequestSchema;
}

// Deutsche Standard-Schemas (Admin, bestehende Aufrufer).
export const itemsSchema = schemas.de.itemsSchema;
export const customerSchema = schemas.de.customerSchema;
export const orderRequestSchema = schemas.de.orderRequestSchema;

export type OrderRequest = z.infer<typeof orderRequestSchema>;
export type OrderRequestInput = z.input<typeof orderRequestSchema>;
