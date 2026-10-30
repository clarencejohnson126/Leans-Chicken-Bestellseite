"use client";

import { useEffect, useState } from "react";

const format = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** Aktuelles Datum und Uhrzeit in Berlin, laufend aktualisiert. Startwert kommt vom Server. */
export function AdminClock({ initial }: { initial: number }) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>Heute: {format.format(now).replace(" um ", " · ")} Uhr</span>;
}
