import { describe, expect, it } from "vitest";
import { priceCart } from "@/lib/pricing";
import { schedule } from "@/config/schedule";
import { isSlotOpen, listDeliveryDays, nextAvailableSlot, resolveSlot } from "@/lib/slots";
import { localParts, localToInstant } from "@/lib/time";
import { normalizePhone, orderRequestSchema } from "@/lib/validation";

describe("Zeitzone Europe/Berlin", () => {
  it("rechnet Winterzeit (MEZ, UTC+1) korrekt um", () => {
    expect(localToInstant("2026-11-25", "11:30").toISOString()).toBe("2026-11-25T10:30:00.000Z");
  });
  it("rechnet Sommerzeit (MESZ, UTC+2) korrekt um", () => {
    expect(localToInstant("2026-07-01", "11:30").toISOString()).toBe("2026-07-01T09:30:00.000Z");
  });
  it("liest das Berliner Kalenderdatum auch kurz vor Mitternacht UTC", () => {
    expect(localParts(new Date("2026-11-24T23:30:00Z")).date).toBe("2026-11-25");
  });
});

describe("Lieferfenster", () => {
  const tuesdayEvening = new Date("2026-11-24T20:00:00Z");

  it("bietet nur Mo, Mi und Do im Buchungshorizont an", () => {
    const days = listDeliveryDays(tuesdayEvening).map((d) => d.date);
    expect(days).toEqual(["2026-11-25", "2026-11-26", "2026-11-30"]);
  });

  it("bietet vor dem Start nur Tage ab dem ersten Liefertag an", () => {
    const days = listDeliveryDays(new Date("2026-10-31T10:00:00Z")).map((d) => d.date);
    expect(days).toEqual(["2026-11-16", "2026-11-18", "2026-11-19", "2026-11-23"]);
  });

  it("schließt ein Fenster 60 Minuten vor Beginn", () => {
    const slot = resolveSlot("2026-11-25_11:30")!;
    expect(isSlotOpen(slot, new Date("2026-11-25T09:29:00Z"))).toBe(true); // 10:29 Berlin
    expect(isSlotOpen(slot, new Date("2026-11-25T09:30:00Z"))).toBe(false); // 10:30 Berlin
  });

  it("lehnt Tage ohne Lieferung und unbekannte Uhrzeiten ab", () => {
    expect(resolveSlot("2026-11-24_11:30")).toBeNull(); // Dienstag
    expect(resolveSlot("2026-11-25_11:45")).toBeNull();
    expect(resolveSlot("kaputt")).toBeNull();
  });

  it("zieht reservierte Strips ab und findet das nächste freie Fenster", () => {
    const days = listDeliveryDays(tuesdayEvening, {
      "2026-11-25_11:30": schedule.maxStripsPerWindow,
      "2026-11-25_12:00": schedule.maxStripsPerWindow - 5,
    });
    const first = days[0].slots;
    expect(first[0].available).toBe(false);
    expect(first[1].remainingStrips).toBe(5);
    expect(nextAvailableSlot(days, 10)?.id).toBe("2026-11-25_12:30");
  });
});

describe("Preise laut Katalog", () => {
  it("berechnet Menüs und Side Orders serverseitig", () => {
    const cart = priceCart({ "family-pack": 1, pommes: 1, mayo: 2 });
    expect(cart.totalCents).toBe(1800 + 300 + 200);
    expect(cart.strips).toBe(10);
    expect(cart.fries).toBe(3);
    expect(cart.menuCount).toBe(1);
    expect(cart.meetsMinimum).toBe(true);
  });

  it("kennt die vier Menüpreise", () => {
    expect(priceCart({ basic: 1 }).totalCents).toBe(800);
    expect(priceCart({ "crunch-combo": 1 }).totalCents).toBe(1000);
    expect(priceCart({ "big-boy-box": 1 }).totalCents).toBe(1400);
    expect(priceCart({ "family-pack": 1 }).totalCents).toBe(1800);
  });

  it("meldet den fehlenden Betrag bis zum Mindestbestellwert", () => {
    const cart = priceCart({ "crunch-combo": 1, ketchup: 1 });
    expect(cart.totalCents).toBe(1100);
    expect(cart.meetsMinimum).toBe(false);
    expect(cart.missingCents).toBe(300);
  });

  it("liefert eine einzelne Big Boy Box ohne Aufstocken", () => {
    expect(priceCart({ "big-boy-box": 1 }).meetsMinimum).toBe(true);
  });

  it("lehnt negative oder gebrochene Mengen ab", () => {
    expect(() => priceCart({ basic: -1 })).toThrow();
  });

  it("weist Pfand getrennt aus und rechnet ihn nicht zum Mindestbestellwert", () => {
    const cart = priceCart({ "crunch-combo": 1, "brambacher-himbeere-zitrone": 1 });
    expect(cart.goodsCents).toBe(1335);
    expect(cart.depositCents).toBe(15);
    expect(cart.totalCents).toBe(1350); // 10,00 + 3,35 + 0,15 Pfand
    expect(cart.bottles).toBe(1);
    expect(cart.meetsMinimum).toBe(false);
    expect(cart.missingCents).toBe(65);
    expect(priceCart({ "crunch-combo": 1, "brambacher-pink-grapefruit": 2 }).meetsMinimum).toBe(true);
    expect(priceCart({ "family-pack": 1 }).depositCents).toBe(0);
    expect(() => priceCart({ basic: 1.5 })).toThrow();
  });
});

describe("Eingabevalidierung", () => {
  const valid = {
    items: { "crunch-combo": 2 },
    slotId: "2026-11-25_12:00",
    customer: { name: "Max", phone: "0162 1234567", street: "Robert-Funari-Str. 1", postalCode: "68309" },
    acceptTerms: true,
  };

  it("normalisiert Telefonnummern auf E.164", () => {
    expect(normalizePhone("0162 123 45 67")).toBe("+491621234567");
    expect(normalizePhone("+49 (162) 1234567")).toBe("+491621234567");
    expect(normalizePhone("00491621234567")).toBe("+491621234567");
    expect(normalizePhone("123")).toBeNull();
  });

  it("akzeptiert eine gültige Bestellung", () => {
    const parsed = orderRequestSchema.parse(valid);
    expect(parsed.customer.phone).toBe("+491621234567");
  });

  it("lehnt Adressen außerhalb von FRANKLIN ab", () => {
    const r = orderRequestSchema.safeParse({ ...valid, customer: { ...valid.customer, postalCode: "68161" } });
    expect(r.success).toBe(false);
  });

  it("verlangt bei Abholung keine Adresse auf FRANKLIN", () => {
    const pickup = { ...valid, fulfillment: "pickup", customer: { name: "Max", phone: "0162 1234567" } };
    expect(orderRequestSchema.safeParse(pickup).success).toBe(true);
    const delivery = { ...pickup, fulfillment: "delivery" };
    const r = orderRequestSchema.safeParse(delivery);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["customer.street", "customer.postalCode"]);
  });

  it("lehnt unbekannte Produkte und Preise aus dem Client ab", () => {
    const r = orderRequestSchema.safeParse({ ...valid, items: { "crunch-combo": 2, priceCents: 1 } });
    expect(r.success).toBe(false);
  });

  it("verlangt mindestens ein Menü", () => {
    expect(orderRequestSchema.safeParse({ ...valid, items: { pommes: 8 } }).success).toBe(false);
  });

  it("begrenzt die Menge pro Position", () => {
    expect(orderRequestSchema.safeParse({ ...valid, items: { basic: 11 } }).success).toBe(false);
  });

  it("verlangt die Zustimmung zu den AGB", () => {
    expect(orderRequestSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });
});

describe("WhatsApp-Bestellvorlage", () => {
  it("listet alle Menüs und Extras mit aktuellen Preisen", async () => {
    const { whatsappOrderTemplate } = await import("@/config/business");
    const text = whatsappOrderTemplate().replace(/\u00a0/g, " ");
    expect(text).toContain("Basic (8,00 €): ");
    expect(text).toContain("Family Pack (18,00 €): ");
    expect(text).toContain("Worcestershire Sauce 1,50 €");
    expect(text).toContain("Mo/Mi/Do, 11:30–14:00 Uhr");
    expect(text).toContain("Adresse, nur bei Lieferung (68309 FRANKLIN): ");
    expect(text).toContain("Lieferung oder Abholung (George-Washington-Straße 219): ");
    expect(text).toContain("Getränke – Bad Brambacher Himbeere-Zitrone / Pink Grapefruit, je 3,50 € inkl. Pfand: ");
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
