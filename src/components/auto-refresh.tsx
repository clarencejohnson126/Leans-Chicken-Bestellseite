"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Lädt die Server-Daten der Seite regelmäßig neu, solange `active` gilt. */
export function AutoRefresh({ seconds, active = true }: { seconds: number; active?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds, active]);
  return null;
}
