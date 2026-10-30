"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

// Auf der Startseite öffnet ein Klick aufs Badge eine große Ansicht, auf allen Unterseiten
// führt das Logo zurück zur Startseite.
export function Logo() {
  const isHome = usePathname() === "/";
  const dialog = useRef<HTMLDialogElement>(null);

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

  if (!isHome) {
    return (
      <Link href="/" className="brand" aria-label="Lean's Crispy Chicken – zur Startseite">
        {badge}
        {wordmark}
      </Link>
    );
  }

  return (
    <div className="brand">
      <button
        type="button"
        className="brand-zoom"
        aria-label="Logo groß anzeigen"
        onClick={() => dialog.current?.showModal()}
      >
        {badge}
      </button>
      {wordmark}
      <dialog
        ref={dialog}
        className="logo-lightbox"
        aria-label="Lean's Logo"
        onClick={() => dialog.current?.close()}
      >
        <Image src="/assets/brand/badge-512.webp" alt="Lean's Crispy Chicken Logo" width={512} height={512} />
        <span className="logo-lightbox-hint">Zum Schließen tippen</span>
      </dialog>
    </div>
  );
}
