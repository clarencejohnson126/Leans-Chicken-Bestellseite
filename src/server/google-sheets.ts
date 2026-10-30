import { createSign } from "node:crypto";
import type { OrderSummary } from "@/server/ports";

// Google-Sheets-Spiegel der bezahlten Bestellungen. Supabase bleibt die Wahrheit; das Sheet ist
// die Arbeitsliste für Lean. Authentifizierung per Service Account (JWT, RS256) ohne googleapis-SDK.

export const SHEET_TAB = "Bestellungen";

export const sheetColumns = [
  "Bestellnummer",
  "Eingang",
  "Liefertag",
  "Fenster",
  "Zahlung",
  "Lieferstatus",
  "Name",
  "Telefon",
  "E-Mail",
  "Firma",
  "Straße",
  "PLZ",
  "Hinweis Adresse",
  "Positionen",
  "Strips",
  "Summe €",
  "Notiz",
  "Quelle",
  "Bestell-ID",
] as const;

const paymentLabel: Record<OrderSummary["paymentStatus"], string> = {
  pending: "offen",
  processing: "SEPA eingereicht",
  paid: "bezahlt",
  expired: "abgelaufen",
  failed: "fehlgeschlagen",
  refunded: "erstattet",
  released: "freigegeben",
};

function berlin(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function orderToRow(order: OrderSummary, receivedAt: Date): (string | number)[] {
  return [
    order.orderNumber,
    berlin(receivedAt),
    order.deliveryDate,
    `${order.slotStart}–${order.slotEnd}`,
    paymentLabel[order.paymentStatus],
    "NEU",
    order.customerName,
    // Führendes Hochkomma verhindert, dass Sheets "+49…" als Formel oder Zahl liest.
    `'${order.customerPhone}`,
    order.customerEmail ?? "",
    order.company,
    order.street,
    order.postalCode,
    order.addressNote,
    order.items.map((i) => `${i.quantity}× ${i.name}`).join(", "),
    order.strips,
    order.totalCents / 100,
    order.customerNote,
    order.source,
    order.id,
  ];
}

type ServiceAccount = { email: string; privateKey: string };

export function createSheetsClient(account: ServiceAccount, spreadsheetId: string) {
  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken() {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value;
    const now = Math.floor(Date.now() / 1000);
    const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString("base64url");
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
      iss: account.email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(account.privateKey, "base64url");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${signature}`,
      }),
    });
    if (!response.ok) throw new Error(`google token ${response.status}: ${await response.text()}`);
    const data = (await response.json()) as { access_token: string; expires_in: number };
    token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return token.value;
  }

  async function call(path: string, init: { method: string; body?: unknown }) {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
      method: init.method,
      headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!response.ok) throw new Error(`google sheets ${response.status}: ${await response.text()}`);
    return response.json() as Promise<Record<string, unknown>>;
  }

  return {
    call,
    async appendOrder(order: OrderSummary, receivedAt = new Date()) {
      const range = encodeURIComponent(`${SHEET_TAB}!A1`);
      await call(`/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: { values: [orderToRow(order, receivedAt)] },
      });
    },
  };
}

export type SheetsClient = ReturnType<typeof createSheetsClient>;

/** Private Keys stehen in Env-Variablen meist mit "\n" statt echten Zeilenumbrüchen. */
export function normalizePrivateKey(raw: string) {
  return raw.replace(/\\n/g, "\n");
}
