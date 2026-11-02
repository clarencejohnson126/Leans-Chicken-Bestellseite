import Link from "next/link";
import { business, phoneHref, taxNote } from "@/config/business";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <nav className="footer-links" aria-label="Rechtliches">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
        </nav>
        <p className="footer-contact">
          Bestellen und Fragen: <a href={phoneHref}>{business.operator.phoneDisplay}</a> (Anruf oder WhatsApp) ·{" "}
          <a href={`mailto:${business.operator.email}`}>{business.operator.email}</a>
        </p>
        <p>
          {business.name} · {business.area} · {taxNote}
        </p>
      </div>
    </footer>
  );
}
