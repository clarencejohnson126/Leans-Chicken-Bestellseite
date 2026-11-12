import { describe, expect, it } from "vitest";
import { whatsappOrderTemplate } from "@/config/business";
import { de } from "@/i18n/de";
import { en } from "@/i18n/en";
import { fill, isLocale, localePath, stripLocale } from "@/i18n/config";
import { formatEuro, formatWindow } from "@/lib/format";
import { formatDay } from "@/lib/time";
import { orderRequestSchema, orderRequestSchemaFor, requestLocale } from "@/lib/validation";

describe("localePath", () => {
  it("lässt deutsche Pfade unverändert", () => {
    expect(localePath("de", "/")).toBe("/");
    expect(localePath("de", "/bestellen")).toBe("/bestellen");
    expect(localePath("de", "/#menue")).toBe("/#menue");
  });

  it("setzt /en vor englische Pfade und behält Query und Hash", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/bestellen")).toBe("/en/bestellen");
    expect(localePath("en", "/#menue")).toBe("/en#menue");
    expect(localePath("en", "/bestellen?add=basic#drinks")).toBe("/en/bestellen?add=basic#drinks");
    expect(localePath("en", "/?x=1")).toBe("/en?x=1");
    expect(localePath("en", "bestellung/danke")).toBe("/en/bestellung/danke");
  });
});

describe("stripLocale", () => {
  it("entfernt /de und /en, aber keine ähnlichen Segmente", () => {
    expect(stripLocale("/en")).toBe("/");
    expect(stripLocale("/en/bestellen")).toBe("/bestellen");
    expect(stripLocale("/de")).toBe("/");
    expect(stripLocale("/de/agb")).toBe("/agb");
    expect(stripLocale("/bestellen")).toBe("/bestellen");
    expect(stripLocale("/entdecken")).toBe("/entdecken");
    expect(stripLocale("")).toBe("/");
  });

  it("ergibt mit localePath den Pfad in der anderen Sprache", () => {
    expect(localePath("en", stripLocale("/bestellung/danke"))).toBe("/en/bestellung/danke");
    expect(localePath("de", stripLocale("/en/umfrage"))).toBe("/umfrage");
  });
});

describe("Sprachhelfer", () => {
  it("erkennt nur unterstützte Sprachen", () => {
    expect(isLocale("de")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("füllt Platzhalter", () => {
    expect(fill("{name} entfernen", { name: "Basic" })).toBe("Basic entfernen");
    expect(fill("{a} {b}", { a: 1 })).toBe("1 {b}");
  });

  it("formatiert Preise, Zeitfenster und Tage je Sprache", () => {
    expect(formatEuro(800).replace(/ /g, " ")).toBe("8,00 €");
    expect(formatEuro(800, "en")).toBe("€8.00");
    expect(formatWindow("11:30", "12:00")).toBe("11:30–12:00 Uhr");
    expect(formatWindow("11:30", "12:00", "en")).toBe("11:30–12:00");
    expect(formatDay("2026-11-16", "short")).toBe("Mo., 16.11.");
    expect(formatDay("2026-11-16", "short", "en")).toBe("Mon 16 Nov");
    expect(formatDay("2026-11-16", "long", "en")).toBe("Monday 16 November");
  });

  it("hat in beiden Wörterbüchern dieselben Schlüssel", () => {
    const keys = (o: object, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
      );
    expect(keys(en).sort()).toEqual(keys(de).sort());
  });

  it("liefert eine englische WhatsApp-Vorlage", () => {
    const text = whatsappOrderTemplate("en");
    expect(text).toContain("Hi Lean's, I'd like to order:");
    expect(text).toContain("Basic (€8.00): ");
    expect(text).toContain("Mon/Wed/Thu, 11:30–15:00");
  });
});

describe("Sprache in der Bestellung", () => {
  const valid = {
    items: { "crunch-combo": 2 },
    slotId: "2026-11-25_12:00",
    customer: { name: "Max", phone: "0162 1234567", street: "Robert-Funari-Str. 1", postalCode: "68309" },
    acceptTerms: true,
  };

  it("nimmt ohne Angabe Deutsch an", () => {
    expect(orderRequestSchema.parse(valid).lang).toBe("de");
  });

  it("übernimmt Englisch", () => {
    expect(orderRequestSchema.parse({ ...valid, lang: "en" }).lang).toBe("en");
  });

  it("lehnt unbekannte Sprachen ab", () => {
    const r = orderRequestSchema.safeParse({ ...valid, lang: "fr" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["lang"]);
  });

  it("liest die Sprache aus beliebigen Bodies mit Fallback Deutsch", () => {
    expect(requestLocale({ lang: "en" })).toBe("en");
    expect(requestLocale({ lang: "fr" })).toBe("de");
    expect(requestLocale(null)).toBe("de");
    expect(requestLocale("x")).toBe("de");
  });

  it("liefert Fehlermeldungen in der Sprache des Formulars", () => {
    const deResult = orderRequestSchemaFor("de").safeParse({ ...valid, acceptTerms: false });
    const enResult = orderRequestSchemaFor("en").safeParse({ ...valid, acceptTerms: false, lang: "en" });
    expect(deResult.error?.issues[0].message).toBe("Bitte bestätige AGB und Datenschutzerklärung.");
    expect(enResult.error?.issues[0].message).toBe("Please accept the terms and privacy policy.");
  });
});
