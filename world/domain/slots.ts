// Delivery slots: SLOT-1 to SLOT-8 in world/requirements/slots.md.
import { on } from "../bugs";
import { addDays, dateLabel, localParts } from "./clock";

export type SlotStatus = "open" | "full" | "closed";
export type Slot = {
  slotId: string; // 2026-03-11T08
  date: string;
  start: string; // 08:00
  end: string; // 09:00
  label: string;
  feeCents: number;
  capacity: number;
  booked: number;
  remaining: number;
  status: SlotStatus;
};

export const FIRST_HOUR = 8;
export const LAST_HOUR = 19; // the last slot starts 19:00 and ends 20:00
export const CUTOFF_HOUR = 22;
export const DATES_SHOWN = 3;

// SLOT-5: 17:00 and 18:00 starts are peak.
export function slotFee(hour: number): number {
  return hour === 17 || hour === 18 ? 499 : 299;
}

// SLOT-3: next-date slots close at 22:00 store time the evening before.
export function cutoffPassed(now: Date, timeZone: string): boolean {
  const hour = on("slot-cutoff") ? now.getUTCHours() : localParts(now, timeZone).hour;
  return hour >= CUTOFF_HOUR;
}

// SLOT-2: a slot takes at most `capacity` orders.
export function isFull(booked: number, capacity: number): boolean {
  return on("slot-capacity") ? booked > capacity : booked >= capacity;
}

const hh = (h: number) => String(h).padStart(2, "0");

export function listSlots(now: Date, timeZone: string, booked: Record<string, number>, capacity: number): Slot[] {
  const today = localParts(now, timeZone).date;
  const closedFirst = cutoffPassed(now, timeZone);
  const out: Slot[] = [];
  for (let d = 1; d <= DATES_SHOWN; d++) {
    const date = addDays(today, d);
    for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) {
      const slotId = `${date}T${hh(h)}`;
      const n = booked[slotId] ?? 0;
      const status: SlotStatus = d === 1 && closedFirst ? "closed" : isFull(n, capacity) ? "full" : "open";
      out.push({
        slotId, date, start: `${hh(h)}:00`, end: `${hh(h + 1)}:00`,
        label: `${dateLabel(date)}, ${hh(h)}:00 to ${hh(h + 1)}:00`,
        feeCents: slotFee(h), capacity, booked: n, remaining: Math.max(0, capacity - n), status,
      });
    }
  }
  return out;
}

export function parseSlotId(id: string): { date: string; hour: number } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})$/.exec(id);
  if (!m) return null;
  const hour = Number(m[2]);
  if (hour < FIRST_HOUR || hour > LAST_HOUR) return null;
  return { date: m[1], hour };
}
