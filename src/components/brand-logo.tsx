"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { localePath, stripLocale, type Locale } from "@/i18n/config";

type LogoLabels = {
  homeLabel: string;
  zoomLabel: string;
  dialogLabel: string;
  imageAlt: string;
  closeHint: string;
};

// Auf der Startseite öffnet ein Klick aufs Badge eine große Ansicht, auf allen Unterseiten
// führt das Logo zurück zur Startseite.
const badge = (
  <Image src="/assets/brand/badge-256.webp" alt="" width={76} height={76} className="brand-badge" priority />
);
const wordmark = (
  <span className="logo" aria-hidden="true">
    <span className="logo-lead">Lean&apos;s</span>
    <span className="logo-middle">Crispy</span>
    <span className="logo-end">CHICKEN</span>
  </span>
);

/** Logo als Link zur Startseite. Auch Platzhalter, solange der Pfad auf dynamischen Seiten noch lädt. */
export function LogoLink({ lang, labels }: { lang: Locale; labels: LogoLabels }) {
  return (
    <Link href={localePath(lang, "/")} className="brand" aria-label={labels.homeLabel}>
      {badge}
      {wordmark}
    </Link>
  );
}

export function Logo({ lang, labels }: { lang: Locale; labels: LogoLabels }) {
  // Mit oder ohne Sprachpräfix (Proxy-Rewrite) dieselbe Antwort, damit Server und Browser übereinstimmen.
  const isHome = stripLocale(usePathname() ?? "/") === "/";
  const dialog = useRef<HTMLDialogElement>(null);

  if (!isHome) return <LogoLink lang={lang} labels={labels} />;

  return (
    <div className="brand">
      <button
        type="button"
        className="brand-zoom"
        aria-label={labels.zoomLabel}
        onClick={() => dialog.current?.showModal()}
      >
        {badge}
      </button>
      {wordmark}
      <dialog
        ref={dialog}
        className="logo-lightbox"
        aria-label={labels.dialogLabel}
        onClick={() => dialog.current?.close()}
      >
        <Image src="/assets/brand/badge-512.webp" alt={labels.imageAlt} width={512} height={512} />
        <span className="logo-lightbox-hint">{labels.closeHint}</span>
      </dialog>
    </div>
  );
}
