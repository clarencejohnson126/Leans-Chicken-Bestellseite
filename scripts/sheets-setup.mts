// Richtet das Bestell-Sheet ein: Tab "Bestellungen", Kopfzeile, Formate, Lieferstatus-Dropdown.
// Idempotent. Aufruf: npm run sheets:setup  (liest GOOGLE_* aus .env.local)
import { SHEET_TAB, createSheetsClient, normalizePrivateKey, sheetColumns } from "../src/server/google-sheets.ts";

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
const sheetId = process.env.GOOGLE_SHEET_ID;
if (!email || !key || !sheetId) {
  console.error("GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY und GOOGLE_SHEET_ID setzen.");
  process.exit(1);
}

const sheets = createSheetsClient({ email, privateKey: normalizePrivateKey(key) }, sheetId);
const fulfillment = ["NEU", "IN ZUBEREITUNG", "FERTIG", "UNTERWEGS", "GELIEFERT", "STORNIERT"];
const col = (name: (typeof sheetColumns)[number]) => sheetColumns.indexOf(name);

type SheetMeta = { properties: { sheetId: number; title: string } };
const meta = (await sheets.call("?fields=sheets.properties", { method: "GET" })) as { sheets: SheetMeta[] };
let tab = meta.sheets.find((s) => s.properties.title === SHEET_TAB);

if (!tab) {
  // Den Standard-Tab umbenennen, falls er der einzige ist; sonst neuen Tab anlegen.
  const only = meta.sheets.length === 1 ? meta.sheets[0] : null;
  await sheets.call(":batchUpdate", {
    method: "POST",
    body: {
      requests: [
        only
          ? { updateSheetProperties: { properties: { sheetId: only.properties.sheetId, title: SHEET_TAB }, fields: "title" } }
          : { addSheet: { properties: { title: SHEET_TAB } } },
      ],
    },
  });
  const again = (await sheets.call("?fields=sheets.properties", { method: "GET" })) as { sheets: SheetMeta[] };
  tab = again.sheets.find((s) => s.properties.title === SHEET_TAB)!;
  console.log(only ? `Tab umbenannt in "${SHEET_TAB}"` : `Tab "${SHEET_TAB}" angelegt`);
}

const id = tab.properties.sheetId;
const columnRange = (index: number) => ({ sheetId: id, startRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 });
const widths: [number, number][] = [
  [col("Bestellnummer"), 130], [col("Eingang"), 130], [col("Liefertag"), 95], [col("Fenster"), 95],
  [col("Zahlung"), 120], [col("Lieferstatus"), 130], [col("Name"), 150], [col("Telefon"), 130],
  [col("E-Mail"), 190], [col("Straße"), 190], [col("Hinweis Adresse"), 180], [col("Positionen"), 260],
  [col("Notiz"), 200], [col("Bestell-ID"), 120],
];
const statusColor: Record<string, { red: number; green: number; blue: number }> = {
  NEU: { red: 1, green: 0.95, blue: 0.75 },
  "IN ZUBEREITUNG": { red: 1, green: 0.87, blue: 0.7 },
  FERTIG: { red: 0.85, green: 0.92, blue: 1 },
  UNTERWEGS: { red: 0.8, green: 0.88, blue: 1 },
  GELIEFERT: { red: 0.8, green: 0.94, blue: 0.82 },
  STORNIERT: { red: 0.93, green: 0.93, blue: 0.93 },
};

// Bedingte Formate vorher entfernen, damit wiederholte Läufe sie nicht stapeln.
const existing = (await sheets.call(`?fields=sheets(properties.sheetId,conditionalFormats)`, { method: "GET" })) as {
  sheets: { properties: { sheetId: number }; conditionalFormats?: unknown[] }[];
};
const ruleCount = existing.sheets.find((s) => s.properties.sheetId === id)?.conditionalFormats?.length ?? 0;

await sheets.call(":batchUpdate", {
  method: "POST",
  body: {
    requests: [
      ...Array.from({ length: ruleCount }, () => ({ deleteConditionalFormatRule: { sheetId: id, index: 0 } })),
      {
        updateCells: {
          range: { sheetId: id, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: sheetColumns.length },
          rows: [{ values: sheetColumns.map((c) => ({ userEnteredValue: { stringValue: c } })) }],
          fields: "userEnteredValue",
        },
      },
      {
        repeatCell: {
          range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.03, green: 0.03, blue: 0.03 },
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
        },
      },
      {
        // Datenzeilen hell und normal, damit angehängte Zeilen nicht das Kopfzeilen-Format erben.
        repeatCell: {
          range: { sheetId: id, startRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 1, green: 1, blue: 1 },
              textFormat: { bold: false, foregroundColor: { red: 0.1, green: 0.1, blue: 0.1 } },
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
        },
      },
      { updateSheetProperties: { properties: { sheetId: id, gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } }, fields: "gridProperties(frozenRowCount,frozenColumnCount)" } },
      {
        repeatCell: {
          range: columnRange(col("Summe €")),
          cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "#,##0.00 €" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      },
      {
        setDataValidation: {
          range: columnRange(col("Lieferstatus")),
          rule: {
            condition: { type: "ONE_OF_LIST", values: fulfillment.map((v) => ({ userEnteredValue: v })) },
            showCustomUi: true,
            strict: true,
          },
        },
      },
      ...Object.entries(statusColor).map(([value, color], index) => ({
        addConditionalFormatRule: {
          index,
          rule: {
            ranges: [columnRange(col("Lieferstatus"))],
            booleanRule: {
              condition: { type: "TEXT_EQ", values: [{ userEnteredValue: value }] },
              format: { backgroundColor: color, textFormat: { bold: value === "NEU" } },
            },
          },
        },
      })),
      ...widths.map(([index, pixelSize]) => ({
        updateDimensionProperties: {
          range: { sheetId: id, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
          properties: { pixelSize },
          fields: "pixelSize",
        },
      })),
    ],
  },
});

console.log(`Sheet eingerichtet: ${sheetColumns.length} Spalten, Lieferstatus-Dropdown (${fulfillment.join(", ")})`);
