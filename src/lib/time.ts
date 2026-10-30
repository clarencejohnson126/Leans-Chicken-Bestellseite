import { schedule } from "@/config/schedule";

// Vercel läuft in UTC. Alle Geschäftslogik rechnet deshalb explizit in Europe/Berlin.

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: schedule.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type LocalParts = {
  date: string; // YYYY-MM-DD
  hour: number;
  minute: number;
};

function rawParts(instant: Date) {
  return Object.fromEntries(
    partsFormatter.formatToParts(instant).map((x) => [x.type, x.value]),
  );
}

export function localParts(instant: Date): LocalParts {
  const p = rawParts(instant);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

function offsetMs(instant: Date) {
  const p = rawParts(instant);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Wandelt eine Berliner Ortszeit (Datum + "HH:MM") in einen absoluten Zeitpunkt um. */
export function localToInstant(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(new Date(guess));
  // Zweiter Durchlauf korrigiert Zeitpunkte nahe der Sommerzeit-Umstellung.
  return new Date(guess - offsetMs(new Date(first)));
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** ISO-Wochentag (1 = Montag … 7 = Sonntag) eines Kalenderdatums. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

const dayLong = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dayShort = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

export function formatDay(date: string, style: "long" | "short" = "long") {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return (style === "long" ? dayLong : dayShort).format(t);
}
