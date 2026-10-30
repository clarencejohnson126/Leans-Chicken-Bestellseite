import type { Metadata } from "next";
import { business, taxNote } from "@/config/business";
import { orderRules } from "@/config/menu";
import { paymentMethodsText } from "@/config/payments";
import { deliveryArea, schedule } from "@/config/schedule";
import { formatEuro } from "@/lib/format";

export const metadata: Metadata = { title: "AGB | Lean's Crispy Chicken" };

export default function TermsPage() {
  return (
    <main className="wrap legal">
      <div className="draft-banner">Entwurf – vor Go-Live rechtlich prüfen lassen.</div>
      <h1>Allgemeine Geschäftsbedingungen</h1>

      <h2>1. Anbieter</h2>
      <p>
        Anbieter ist {business.operator.name} ({business.name}), siehe Impressum.
      </p>

      <h2>2. Vertragsschluss</h2>
      <p>
        Mit Klick auf „Zur Bezahlung“ und Abschluss der Zahlung gibst du eine verbindliche Bestellung
        ab. Der Vertrag kommt mit der Bestätigung deiner Bestellung nach erfolgreicher Zahlung
        zustande.
      </p>

      <h2>3. Preise und Mindestbestellwert</h2>
      <p>
        Es gelten die zum Zeitpunkt der Bestellung angezeigten Preise. {taxNote} Der
        Mindestbestellwert beträgt {formatEuro(orderRules.minOrderCents)}. Eine Liefergebühr fällt
        nicht an.
      </p>

      <h2>4. Lieferung</h2>
      <p>
        Wir liefern ausschließlich nach {deliveryArea.label} im gewählten Lieferfenster. Bestellungen
        sind bis {schedule.orderLeadMinutes} Minuten vor Beginn des Lieferfensters möglich. Bitte sei
        im Lieferfenster unter der angegebenen Adresse und Mobilnummer erreichbar.
      </p>

      <h2>5. Zahlung</h2>
      <p>
        Die Zahlung erfolgt im Voraus online über den Zahlungsdienstleister Stripe ({paymentMethodsText}).
        Bei SEPA-Lastschrift erteilst du Stripe ein Lastschriftmandat; wird die Lastschrift
        zurückgegeben, bleibt der Kaufpreis fällig.
      </p>

      <h2>6. Kein Widerrufsrecht</h2>
      <p>
        Bei der Lieferung von Waren, die schnell verderben können, besteht kein Widerrufsrecht
        (§ 312g Abs. 2 Nr. 2 BGB). Das gilt für unsere frisch zubereiteten Speisen.
      </p>

      <h2>7. Stornierung und Ausfall</h2>
      <p>
        Können wir eine bezahlte Bestellung nicht liefern, informieren wir dich und erstatten den
        vollen Betrag. Änderungswünsche bitte frühzeitig über WhatsApp.
      </p>

      <h2>8. Allergene</h2>
      <p>Informationen zu Allergenen findest du auf der Startseite unter „Gut zu wissen“.</p>
    </main>
  );
}
