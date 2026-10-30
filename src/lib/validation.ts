import { z } from "zod";
import { itemIds, menus, orderRules, type ItemId } from "@/config/menu";
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
  street: text(120).min(3, "Bitte gib Straße und Hausnummer an."),
  postalCode: z
    .string()
    .trim()
    .refine(
      (v) => (deliveryArea.postalCodes as readonly string[]).includes(v),
      `Wir liefern aktuell nur nach ${deliveryArea.label} (PLZ ${deliveryArea.postalCodes.join(", ")}).`,
    ),
  addressNote: text(160).optional().default(""),
});

export const orderRequestSchema = z.object({
  items: itemsSchema,
  slotId: z.string().regex(/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/, "Bitte wähle eine Lieferzeit."),
  customer: customerSchema,
  note: text(300).optional().default(""),
  acceptTerms: z.literal(true, "Bitte bestätige AGB und Datenschutzerklärung."),
});

export type OrderRequest = z.infer<typeof orderRequestSchema>;
export type OrderRequestInput = z.input<typeof orderRequestSchema>;
