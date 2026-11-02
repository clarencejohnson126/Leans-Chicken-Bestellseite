import { z } from "zod";
import { drinkIds, drinksEnabled, itemIds, menus, orderRules, type ItemId } from "@/config/menu";
import { deliveryArea } from "@/config/schedule";

/** Normalisiert Telefonnummern auf E.164 (+49… als Standard). Gibt null zurück, wenn ungültig. */
export function normalizePhone(raw: string): string | null {
  let n = raw.replace(/[\s()/.-]/g, "");
  if (n.startsWith("00")) n = `+${n.slice(2)}`;
  else if (n.startsWith("0")) n = `+49${n.slice(1)}`;
  else if (!n.startsWith("+")) n = `+49${n}`;
  return /^\+[1-9]\d{8,14}$/.test(n) ? n : null;
}

const quantity = z
  .number()
  .int()
  .min(0)
  .max(
    orderRules.maxQuantityPerItem,
    `Maximal ${orderRules.maxQuantityPerItem} Stück pro Position. Für größere Mengen schreib uns auf WhatsApp.`,
  );
const menuQuantity = (items: Partial<Record<ItemId, number>>) =>
  menus.reduce((n, m) => n + (items[m.id] ?? 0), 0);

export const itemsSchema = z
  .object(
    Object.fromEntries(itemIds.map((id) => [id, quantity.optional()])) as Record<
      ItemId,
      z.ZodOptional<typeof quantity>
    >,
  )
  .strict()
  .refine(
    (items) => !orderRules.requireMenu || menuQuantity(items) > 0,
    "Bitte wähle mindestens ein Menü.",
  )
  .refine(
    (items) => drinksEnabled() || drinkIds.every((id) => !items[id]),
    "Getränke sind noch nicht bestellbar.",
  );

const text = (max: number) => z.string().trim().max(max);

export const customerSchema = z.object({
  name: text(80).min(2, "Bitte gib deinen Namen an."),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Bitte gib eine gültige Mobilnummer an." });
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

export const orderRequestSchema = z
  .object({
    items: itemsSchema,
    fulfillment: z.enum(["delivery", "pickup"]).optional().default("delivery"),
    slotId: z.string().regex(/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/, "Bitte wähle eine Zeit."),
    customer: customerSchema,
    note: text(300).optional().default(""),
    acceptTerms: z.literal(true, "Bitte bestätige AGB und Datenschutzerklärung."),
  })
  .superRefine((order, ctx) => {
    if (order.fulfillment !== "delivery") return;
    if (order.customer.street.length < 3) {
      ctx.addIssue({ code: "custom", path: ["customer", "street"], message: "Bitte gib Straße und Hausnummer an." });
    }
    if (!(deliveryArea.postalCodes as readonly string[]).includes(order.customer.postalCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["customer", "postalCode"],
        message: `Wir liefern aktuell nur nach ${deliveryArea.label} (PLZ ${deliveryArea.postalCodes.join(", ")}). Abholen geht immer.`,
      });
    }
  })
  // Bei Abholung keine Adresse speichern, auch wenn das Formular noch eine enthält.
  .transform((order) =>
    order.fulfillment === "pickup"
      ? { ...order, customer: { ...order.customer, street: "", postalCode: "", addressNote: "" } }
      : order,
  );

export type OrderRequest = z.infer<typeof orderRequestSchema>;
export type OrderRequestInput = z.input<typeof orderRequestSchema>;
