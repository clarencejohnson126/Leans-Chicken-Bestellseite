import type { Metadata } from "next";
import Link from "next/link";
import { fontVariables } from "@/app/fonts";
import "./globals.css";

// Ohne gemeinsames Root-Layout ([lang] und admin) braucht die 404 für unbekannte URLs ein eigenes
// HTML-Dokument. Zweisprachig, weil die Sprache hier nicht feststeht.
export const metadata: Metadata = {
  title: "404 | Lean's Crispy Chicken",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="de" className={fontVariables}>
      <body>
        <main className="wrap status-page">
          <p className="eyebrow">404</p>
          <h1>
            Nicht <span className="brush">gefunden</span>
          </h1>
          <p className="lead">Diese Seite gibt es nicht (mehr).</p>
          <p className="lead" lang="en">
            This page doesn&apos;t exist (any more).
          </p>
          <div className="status-actions">
            <Link href="/" className="btn btn-red">
              Zur Startseite
            </Link>
            <Link href="/en" className="btn btn-ghost" hrefLang="en" lang="en">
              English homepage
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
