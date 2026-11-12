import { schedule } from "@/config/schedule";
import { addDays, isoWeekday, localParts, localToInstant } from "@/lib/time";

export type Slot = {
  id: string; // "2026-10-28_11:30"
  date: string;
  start: string;
  end: string;
  startsAt: Date;
  cutoffAt: Date;
};

export type SlotAvailability = Slot & {
  open: boolean; // vor Bestellschluss
  remainingStrips: number;
  available: boolean; // offen und noch Kapazität
};

export type DeliveryDay = {
  date: string;
  slots: SlotAvailability[];
};

const deliveryWeekdays: readonly number[] = schedule.deliveryWeekdays;

export function slotId(date: string, start: string) {
  return `${date}_${start}`;
}

function buildSlot(date: string, window: { start: string; end: string }): Slot {
  const startsAt = localToInstant(date, window.start);
  return {
    id: slotId(date, window.start),
    date,
    start: window.start,
    end: window.end,
    startsAt,
    cutoffAt: localToInstant(date, schedule.orderCutoff),
  };
}

/** Löst eine Slot-ID gegen den Lieferplan auf. Unbekannte IDs ergeben null. */
export function resolveSlot(id: string): Slot | null {
  const match = /^(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/.exec(id);
  if (!match) return null;
  const [, date, start] = match;
  if (!deliveryWeekdays.includes(isoWeekday(date))) return null;
  const window = schedule.windows.find((w) => w.start === start);
  return window ? buildSlot(date, window) : null;
}

export function isSlotOpen(slot: Slot, now: Date) {
  return now.getTime() < slot.cutoffAt.getTime();
}

/** Erster buchbarer Kalendertag: heute, vor dem Start des Testlaufs aber der erste Liefertag. */
function firstBookableDate(now: Date) {
  const today = localParts(now).date;
  return today < schedule.firstDeliveryDate ? schedule.firstDeliveryDate : today;
}

/** Liegt der Slot innerhalb des Buchungshorizonts (nicht vor dem Start, nicht zu weit in der Zukunft)? */
export function isWithinHorizon(slot: Slot, now: Date) {
  const first = firstBookableDate(now);
  return slot.date >= first && slot.date <= addDays(first, schedule.daysAhead);
}

/** Alle Liefertage im Buchungshorizont, mit Verfügbarkeit je Fenster. */
export function listDeliveryDays(
  now: Date,
  reservedStrips: Record<string, number> = {},
): DeliveryDay[] {
  const first = firstBookableDate(now);
  const days: DeliveryDay[] = [];
  for (let i = 0; i <= schedule.daysAhead; i++) {
    const date = addDays(first, i);
    if (!deliveryWeekdays.includes(isoWeekday(date))) continue;
    const slots = schedule.windows.map((w) => {
      const slot = buildSlot(date, w);
      const open = isSlotOpen(slot, now);
      const remainingStrips = Math.max(
        0,
        schedule.maxStripsPerWindow - (reservedStrips[slot.id] ?? 0),
      );
      return { ...slot, open, remainingStrips, available: open && remainingStrips > 0 };
    });
    days.push({ date, slots });
  }
  return days;
}

/** Nächstes buchbares Fenster für eine gewünschte Strip-Anzahl, z. B. als Alternative. */
export function nextAvailableSlot(days: DeliveryDay[], strips: number, after?: string) {
  for (const day of days) {
    for (const slot of day.slots) {
      if (after && slot.id <= after) continue;
      if (slot.open && slot.remainingStrips >= strips) return slot;
    }
  }
  return null;
}
