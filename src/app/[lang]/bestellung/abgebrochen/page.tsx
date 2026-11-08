import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { getDictionary, localePath, resolveLocale, type Locale } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/bestellung/abgebrochen">): Promise<Metadata> {
  const lang = await resolveLocale(params);
  return { title: getDictionary(lang).meta.cancelledTitle };
}

export default async function CancelledPage({ params, searchParams }: PageProps<"/[lang]/bestellung/abgebrochen">) {
  const lang = await resolveLocale(params);
  const t = getDictionary(lang).cancelled;
  return (
    <main className="wrap status-page">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>
        {t.titleBefore}
        <span className="brush">{t.titleBrush}</span>
        {t.titleAfter}
      </h1>
      <p className="lead">{t.lead}</p>
      <div className="status-actions">
        <Link href={localePath(lang, "/bestellen")} className="btn btn-red">
          {t.retry}
        </Link>
        <Suspense fallback={null}>
          <ContactButton searchParams={searchParams} lang={lang} />
        </Suspense>
      </div>
    </main>
  );
}

async function ContactButton({
  searchParams,
  lang,
}: Pick<PageProps<"/[lang]/bestellung/abgebrochen">, "searchParams"> & { lang: Locale }) {
  const t = getDictionary(lang).cancelled;
  const { order } = await searchParams;
  const orderNumber = typeof order === "string" ? order : null;
  return (
    <WhatsAppButton
      label={t.contact}
      text={orderNumber ? t.whatsappWithOrder(orderNumber) : t.whatsappPlain}
      lang={lang}
    />
  );
}
