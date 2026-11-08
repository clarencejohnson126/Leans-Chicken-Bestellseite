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
        <a className="footer-social" href={business.instagram.url} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" />
          </svg>
          <span>
            Folg uns auf Instagram <b>@{business.instagram.handle}</b>
          </span>
        </a>
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
