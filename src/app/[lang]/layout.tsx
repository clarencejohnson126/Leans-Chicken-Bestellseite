import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/app/fonts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { business } from "@/config/business";
import { getDictionary, locales, localePath, ogLocale, resolveLocale } from "@/i18n";
import "../globals.css";

// Root-Layout aller Kundenseiten. Deutsch liegt unter den unpräfixierten URLs (Proxy schreibt intern
// auf /de/… um), Englisch unter /en/…; andere Werte ergeben eine 404.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const lang = await resolveLocale(params);
  const t = getDictionary(lang).meta;
  return {
    metadataBase: new URL(business.siteUrl),
    title: t.siteTitle(business.name),
    description: t.siteDescription,
    openGraph: {
      title: `${business.name} — ${t.tagline}`,
      description: t.ogDescription,
      locale: ogLocale[lang],
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      type: "website",
      images: [{ url: "/assets/photos/approved-team.webp", width: 1800, height: 3197 }],
    },
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, localePath(l, "/")])),
    },
    // Bis Impressum und Rechtstexte final sind, nicht indexieren.
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#080808",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const lang = await resolveLocale(params);
  return (
    <html lang={lang} className={fontVariables}>
      <body>
        <SiteHeader lang={lang} />
        {children}
        <SiteFooter lang={lang} />
        <Analytics />
      </body>
    </html>
  );
}
