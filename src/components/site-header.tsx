import Link from "next/link";
import { Suspense } from "react";
import { Logo, LogoLink } from "@/components/brand-logo";
import { LanguageSwitch, LanguageSwitchFallback } from "@/components/language-switch";
import { business, phoneHref, pilot, pilotDates } from "@/config/business";
import { getDictionary, localePath, type Locale } from "@/i18n";

export function SiteHeader({ lang, languageSwitch = true }: { lang: Locale; languageSwitch?: boolean }) {
  const dict = getDictionary(lang);
  const t = dict.header;
  const dates = pilotDates(lang);
  const href = (path: string) => localePath(lang, path);
  return (
    <header className="header">
      <div className="wrap header-inner">
        {/* usePathname braucht auf dynamischen Seiten (z. B. Bestellverfolgung) eine Suspense-Grenze. */}
        <div className="header-brand">
          <Suspense fallback={<LogoLink lang={lang} labels={dict.logo} />}>
            <Logo lang={lang} labels={dict.logo} />
          </Suspense>
          <Link href={href("/#testlauf")} className="pilot-badge">
            <b>{pilot.label}</b>
            <span>
              {t.pilotStart} {dates.startShort} · {t.pilotUntil} {dates.endShort}
            </span>
          </Link>
        </div>
        <nav className="header-nav" aria-label={t.navLabel}>
          <Link href={href("/#menue")}>{t.menu}</Link>
          <Link href={href("/#so-gehts")}>{t.howItWorks}</Link>
          <Link href={href("/#fragen")}>{t.faq}</Link>
          <a href={phoneHref} className="header-phone">
            {business.operator.phoneDisplay}
          </a>
        </nav>
        <div className="header-actions">
          {languageSwitch && (
            <Suspense fallback={<LanguageSwitchFallback lang={lang} labels={dict.langSwitch} />}>
              <LanguageSwitch lang={lang} labels={dict.langSwitch} />
            </Suspense>
          )}
          <Link href={href("/bestellen")} className="btn btn-red">
            {t.order}
          </Link>
        </div>
      </div>
    </header>
  );
}
