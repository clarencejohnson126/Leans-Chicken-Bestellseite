import Link from "next/link";
import { business, taxNote } from "@/config/business";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <nav className="footer-links" aria-label="Rechtliches">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
        </nav>
        <p>
          {business.name} · {business.area} · {taxNote}
        </p>
      </div>
    </footer>
  );
}
