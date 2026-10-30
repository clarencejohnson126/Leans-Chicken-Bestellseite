# Lean's Crispy Chicken Bestellseite – Implementation Plan

Stand: 27.10.2026. Bauplan für den 4-Wochen-Liefer-Pilot auf FRANKLIN.

## Entscheidungen (vom Betreiber bestätigt)

- Menü laut Menükarte (FLYER RÜCKSEITE): Basic 6 €, Crunch Combo 8 €, Big Boy Box 11 €, Family Pack 14 €. Side Orders: Pommes 2,50 €, Worcestershire Sauce 1 €, Ketchup 0,50 €, Mayo 0,50 € (Mayo-Preis angenommen).
- Mindestens ein Menü pro Bestellung, max. 10 Stück pro Position.
- Mindestbestellwert 15 €, keine Liefergebühr, Lieferung per Fahrrad.
- Liefergebiet: ganz FRANKLIN, freie Adresseingabe, PLZ 68309.
- Liefertage Mo, Mi, Do. Keine Drops, sondern Wunsch-Lieferfenster (30 Min.) mit Kapazität pro Fenster.
- Zahlung: Karte (inkl. Debitkarten mit Visa/Mastercard), Apple Pay, Google Pay, SEPA-Lastschrift. SEPA-Bestellungen werden im Status `processing` geliefert; geplatzte Lastschrift → Meldung (`checkout.session.async_payment_failed`).
- Kleinunternehmer § 19 UStG.
- Hosting auf Vercel, eigene Domain kommt später.

Annahmen (änderbar in `src/config/`): Fenster 11:30–14:00, 60 Chicken Strips pro Fenster, Bestellschluss 60 Min. vorher, 7 Tage Vorlauf, Reservierung offener Zahlungen 30 Min.

## Architektur

```
Browser ──► Next.js (Vercel) ──► Supabase/Postgres (Source of Truth)
                │   ▲
                │   └── Stripe Webhook (einzige Quelle für "bezahlt")
                ├──► Stripe Checkout
                ├──► Google Sheets (Spiegel, nach Zahlung)
                └──► Resend (Benachrichtigung, nach Zahlung)
```

- `src/config/` – Katalog, Lieferplan, Betreiberdaten. Einzige Stelle für Preise und Zeiten.
- `src/lib/` – reine Domänenlogik: Preise, Slots, Zeitzone, Validierung (Zod). Unit-getestet.
- `src/server/ports.ts` – Schnittstellen `OrderStore`, `PaymentProvider` (später `Notifier`, `SheetExporter`).
- `src/server/orders.ts` – Order-Service: Slot, Bestellschluss, Mindestwert, Kapazität, Checkout.
- `src/server/integrations.ts` – verdrahtet die Adapter anhand der Env-Variablen.
- `supabase/migrations/` – Schema, atomare Kapazitätsprüfung (`create_pending_order`), RLS.

## Phasen

| # | Inhalt | Status |
|---|---|---|
| 1 | Projekt, Branding, Startseite, Bestellformular, Rechtsseiten (Entwurf), Domänenlogik + Tests, API-Route, DB-Migration | ✅ erledigt |
| 2 | Supabase-Adapter, Migration anwenden, Verfügbarkeit live | offen |
| 3 | Stripe Checkout (Karte, Apple/Google Pay, SEPA), Webhook mit Signaturprüfung + Idempotenz, `completed` / `async_payment_succeeded` / `async_payment_failed` / `expired` | offen |
| 4 | Danke-Seite mit echten Bestelldaten aus Session-ID, Retry-Zahlung | offen |
| 5 | Google-Sheets-Spiegel + Resend-Benachrichtigung, Fehler markieren, Retry | offen |
| 6 | `/admin`: Magic Link, Tagesübersicht, Produktionsmengen je Fenster, Status-Buttons, SEPA-ausstehend-Badge, WhatsApp-Bestellung + Zahlungslink, Erstattung, Pause-Schalter | offen |
| 7 | E2E-Test im Stripe-Testmodus (Website + WhatsApp-Flow), Vercel-Deploy | offen |
| 8 | Go-Live-Checkliste, Stripe Live | offen |

## Qualitäts-Gate

`npm run verify` = Lint + Typecheck + Tests + Build. Muss vor jedem Deploy grün sein.

## Offen vor Go-Live

- Impressum: ladungsfähige Anschrift. AGB/Datenschutz rechtlich prüfen.
- **Allergene bestätigen** (`src/config/menu.ts`, `allergens.confirmed`): aktuell vorläufige Annahmen.
- Mayo-Preis bestätigen.
- Gewerbeanmeldung und Registrierung bei der Lebensmittelüberwachung.
- Markenname final klären.
