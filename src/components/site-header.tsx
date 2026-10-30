import Link from "next/link";
import { Suspense } from "react";
import { Logo, LogoLink } from "@/components/brand-logo";

export function SiteHeader() {
  return (
    <header className="header">
      <div className="wrap header-inner">
        {/* usePathname braucht auf dynamischen Seiten (z. B. Bestellverfolgung) eine Suspense-Grenze. */}
        <Suspense fallback={<LogoLink />}>
          <Logo />
        </Suspense>
        <nav className="header-nav" aria-label="Hauptnavigation">
          <Link href="/#menue">Menü</Link>
          <Link href="/#so-gehts">So geht&apos;s</Link>
          <Link href="/#fragen">Fragen</Link>
        </nav>
        <Link href="/bestellen" className="btn btn-red">
          Bestellen
        </Link>
      </div>
    </header>
  );
}
