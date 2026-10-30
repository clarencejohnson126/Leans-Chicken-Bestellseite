# Lean's Crispy Chicken · Bestellseite

Vorbestell-, Bezahl- und Order-Management-System für den Liefer-Pilot von Lean's Crispy Chicken auf FRANKLIN, Mannheim. Separates Projekt neben der MWSP-Pitch-Seite.

Stack: Next.js 16 (App Router, Cache Components), React 19, TypeScript, Zod, Vitest. Geplant: Supabase, Stripe Checkout, Google Sheets, Resend. Details und Phasen: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Entwicklung

```sh
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
npm run verify               # Lint + Typecheck + Tests + Build
```

## Wo was gepflegt wird

- `src/config/menu.ts` – Produkt, Preis, Soßen, Mindestbestellwert, Allergene
- `src/config/schedule.ts` – Liefertage, Lieferfenster, Kapazität, Bestellschluss, Liefergebiet
- `src/config/business.ts` – Betreiber, WhatsApp, Steuerhinweis
- `src/app/globals.css` – Brand-Farben und Layout

Preise werden ausschließlich serverseitig aus `menu.ts` berechnet. Als bezahlt gilt eine Bestellung nur über den Stripe-Webhook, nie über die Danke-Seite.

## Routen

| Route | Zweck |
|---|---|
| `/` | Startseite mit Menü, Ablauf, FAQ/Allergenen |
| `/bestellen` | Bestellformular (Portionen → Lieferzeit → Adresse → Bezahlung) |
| `POST /api/orders` | Validierung, Preis, Kapazität, Checkout. Ohne Integrationen: 503 |
| `/bestellung/danke`, `/bestellung/abgebrochen` | Rückkehr von Stripe |
| `/impressum`, `/datenschutz`, `/agb` | Rechtstexte (Entwurf) |

## Datenbank

`supabase/migrations/0001_orders.sql` legt Tabellen, RLS (nur Service Role) und die atomare Funktion `create_pending_order` an, die Kapazität pro Lieferfenster unter Sperre prüft.
