import type { Metadata } from "next";
import { business } from "@/config/business";

export const metadata: Metadata = { title: "Datenschutz | Lean's Crispy Chicken" };

export default function PrivacyPage() {
  const { operator } = business;
  return (
    <main className="wrap legal">
      <div className="draft-banner">
        Entwurf – an die tatsächlich eingesetzten Dienste anpassen und rechtlich prüfen lassen.
      </div>
      <h1>Datenschutzerklärung</h1>

      <h2>Verantwortlicher</h2>
      <p>
        {operator.name}, {operator.company}, {operator.street}, {operator.city}. E-Mail:{" "}
        <a href={`mailto:${operator.legalEmail}`}>{operator.legalEmail}</a>
      </p>

      <h2>Welche Daten wir verarbeiten</h2>
      <p>
        Für die Abwicklung deiner Bestellung verarbeiten wir Name, Mobilnummer, Lieferadresse,
        optional Firma und Anmerkungen, die bestellten Produkte, Liefertag und Lieferfenster sowie
        den Zahlungsstatus. Kartendaten erhalten und speichern wir nicht.
      </p>
      <p>Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).</p>

      <h2>Umfrage zum Testlauf</h2>
      <p>
        Die Umfrage ist anonym. Wir speichern nur deine Antworten, einen freiwilligen Tipp und den
        Zeitpunkt, aber keinen Namen, keine Kontaktdaten und keine IP-Adresse. Schreib bitte keine
        persönlichen Daten in das Tipp-Feld. Tipps leiten wir per E-Mail an unser Postfach weiter.
        Rechtsgrundlage ist unser berechtigtes Interesse, das Angebot zu verbessern (Art. 6 Abs. 1
        lit. f DSGVO).
      </p>

      <h2>Eingesetzte Dienstleister</h2>
      <ul>
        <li>Vercel Inc. – Hosting der Website (Server-Logs mit IP-Adresse).</li>
        <li>
          Vercel Web Analytics – anonyme Reichweitenmessung (aufgerufene Seiten, Herkunftsseite, Land,
          Gerätetyp). Ohne Cookies; die IP-Adresse wird nicht gespeichert, Besucher werden nur über einen
          täglich wechselnden Hash gezählt und nicht über mehrere Tage oder Websites wiedererkannt.
        </li>
        <li>Supabase Inc. – Speicherung der Bestelldaten in einer Datenbank in der EU.</li>
        <li>Stripe Payments Europe Ltd. – Zahlungsabwicklung; Stripe verarbeitet deine Zahlungsdaten in eigener Verantwortung.</li>
        <li>Google Ireland Ltd. – interne Bestellübersicht in Google Sheets.</li>
        <li>Resend – Versand von Bestellbestätigungen, Lieferstatus-Mails und internen Bestellbenachrichtigungen per E-Mail.</li>
        <li>WhatsApp Ireland Ltd. – nur wenn du uns von dir aus über WhatsApp kontaktierst.</li>
      </ul>

      <h2>Speicherdauer</h2>
      <p>
        Bestelldaten speichern wir, solange es für die Abwicklung und gesetzliche
        Aufbewahrungspflichten erforderlich ist. Kontaktdaten, die nicht aufbewahrt werden müssen,
        löschen wir spätestens [Frist ergänzen] nach Ende des Pilotprojekts.
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerspruch sowie auf Beschwerde bei einer Aufsichtsbehörde, z. B.
        dem Landesbeauftragten für den Datenschutz Baden-Württemberg.
      </p>

      <h2>Cookies</h2>
      <p>Diese Website setzt keine Tracking- oder Marketing-Cookies.</p>
    </main>
  );
}
