const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function formatEuro(cents: number) {
  return euro.format(cents / 100);
}

export function formatWindow(start: string, end: string) {
  return `${start}–${end} Uhr`;
}
