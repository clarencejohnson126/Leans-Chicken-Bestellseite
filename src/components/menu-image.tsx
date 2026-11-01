"use client";

import Image from "next/image";
import { useRef } from "react";

/** Menübild, das per Klick in voller Auflösung groß aufgeht. Schließen per Klick, Escape oder ×. */
export function MenuImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="menu-zoom"
        onClick={() => dialog.current?.showModal()}
        aria-label={`${alt}, groß anzeigen`}
      >
        <Image src={src} alt={alt} width={1448} height={1086} sizes={sizes} />
        <span className="menu-zoom-hint" aria-hidden="true">
          ⤢
        </span>
      </button>
      <dialog ref={dialog} className="lightbox" aria-label={alt} onClick={() => dialog.current?.close()}>
        <Image src={src} alt={alt} width={1448} height={1086} unoptimized />
        <button type="button" className="lightbox-close" aria-label="Schließen">
          ×
        </button>
      </dialog>
    </>
  );
}
