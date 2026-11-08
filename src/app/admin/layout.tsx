import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/app/fonts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { business } from "@/config/business";
import "../globals.css";

// Eigenes Root-Layout für den Admin-Bereich: immer deutsch, ohne Sprachumschalter.
export const metadata: Metadata = {
  metadataBase: new URL(business.siteUrl),
  title: "Admin | Lean's Crispy Chicken",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#080808",
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="de" className={fontVariables}>
      <body>
        <SiteHeader lang="de" languageSwitch={false} />
        {children}
        <SiteFooter lang="de" />
        <Analytics />
      </body>
    </html>
  );
}
