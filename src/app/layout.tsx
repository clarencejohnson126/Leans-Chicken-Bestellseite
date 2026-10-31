import type { Metadata, Viewport } from "next";
import { Kaushan_Script, Manrope, Permanent_Marker } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { business } from "@/config/business";
import "./globals.css";

const display = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const script = Kaushan_Script({ subsets: ["latin"], weight: "400", variable: "--font-script" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(business.siteUrl),
  title: `${business.name} | Chicken Strips auf FRANKLIN bestellen`,
  description:
    "Crispy Chicken Strips mit Pommes, frisch gemacht und geliefert. Montag, Mittwoch und Donnerstag auf ganz FRANKLIN, Mannheim.",
  openGraph: {
    title: `${business.name} — ${business.tagline}`,
    description: "Vorbestellen, bezahlen, wir liefern. Ganz FRANKLIN, ohne Liefergebühr.",
    locale: "de_DE",
    type: "website",
    images: [{ url: "/assets/photos/approved-team.webp", width: 1800, height: 3197 }],
  },
  // Bis Impressum und Rechtstexte final sind, nicht indexieren.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#080808",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${display.variable} ${script.variable} ${body.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
