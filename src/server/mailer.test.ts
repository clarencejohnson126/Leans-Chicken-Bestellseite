import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { OrderSummary } from "@/server/ports";

vi.mock("server-only", () => ({}));
const { confirmationMail, notificationMail, onTheWayMail } = await import("@/server/mailer");

const order: OrderSummary = {
  id: "order-1",
  orderNumber: "LEAN-1104-007",
  source: "website",
  paymentStatus: "paid",
  customerName: "Max <b>Müller</b>",
  customerPhone: "+4917612345678",
  customerEmail: "max@example.com",
  company: "",
  street: "Robert-Funari-Straße 5",
  postalCode: "68309",
  addressNote: "3. OG",
  customerNote: "Bitte klingeln",
  slotId: "2026-11-04_12:00",
  deliveryDate: "2026-11-04",
  slotStart: "12:00",
  slotEnd: "12:30",
  strips: 10,
  totalCents: 2100,
  items: [
    { itemId: "crunch-combo", name: "Crunch Combo", quantity: 2, lineTotalCents: 2000 },
    { itemId: "ketchup", name: "Ketchup", quantity: 1, lineTotalCents: 100 },
  ],
  trackingToken: "0123456789abcdef0123456789abcdef",
};

describe("E-Mails", () => {
  const mails = { confirmation: confirmationMail(order), onTheWay: onTheWayMail(order), notification: notificationMail(order) };

  it("enthält Logo, Verfolgungslink und Bestelldaten", () => {
    const { html, subject } = mails.confirmation;
    expect(subject).toContain("LEAN-1104-007");
    expect(html).toContain("/assets/brand/badge-email.png");
    expect(html).toContain("/bestellung/verfolgen/0123456789abcdef0123456789abcdef");
    expect(html).toContain("21,00");
    expect(html).toContain("Mittwoch, 4. November");
  });

  it("maskiert Kundeneingaben", () => {
    for (const mail of Object.values(mails)) expect(mail.html).not.toContain("<b>Müller</b>");
  });

  // MAIL_PREVIEW_DIR=/pfad npx vitest run src/server/mailer.test.ts schreibt die Mails als HTML-Vorschau.
  it.runIf(process.env.MAIL_PREVIEW_DIR)("schreibt eine Vorschau", () => {
    for (const [name, mail] of Object.entries(mails)) writeFileSync(join(process.env.MAIL_PREVIEW_DIR!, `${name}.html`), mail.html);
  });
});
