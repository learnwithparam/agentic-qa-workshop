// Delivery slots: SLOT-1 to SLOT-8 in world/requirements/slots.md.
import { bugIsOn } from "../bugs";
import { addDays, dateLabel, localParts } from "./clock";

export type SlotStatus = "open" | "full" | "closed";
export type Slot = {
  slotId: string; // 2026-03-11T08
  date: string;
  start: string; // 08:00
  end: string; // 09:00
  dateText: string; // Wed, Mar 11
  label: string; // Wed, Mar 11, 08:00 to 09:00
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
  let hour = localParts(now, timeZone).hour;
  if (bugIsOn("slot-cutoff")) {
    hour = now.getUTCHours();
  }
  return hour >= CUTOFF_HOUR;
}

// SLOT-2: a slot takes at most `capacity` orders.
export function isFull(booked: number, capacity: number): boolean {
  if (bugIsOn("slot-capacity")) {
    return booked > capacity;
  }
  return booked >= capacity;
}

// Turns 8 into "08", so every hour has two digits.
const twoDigits = (hour: number) => String(hour).padStart(2, "0");

function slotStatus(isFirstDate: boolean, closedFirst: boolean, full: boolean): SlotStatus {
  if (isFirstDate && closedFirst) {
    return "closed";
  }
  if (full) {
    return "full";
  }
  return "open";
}

type SlotPlace = { date: string; hour: number; bookedCount: number; capacity: number };

function makeSlot(place: SlotPlace, status: SlotStatus): Slot {
  const { date, hour, bookedCount, capacity } = place;
  const start = `${twoDigits(hour)}:00`;
  const end = `${twoDigits(hour + 1)}:00`;
  const dateText = dateLabel(date);
  return {
    slotId: `${date}T${twoDigits(hour)}`,
    date,
    start,
    end,
    dateText,
    label: `${dateText}, ${start} to ${end}`,
    feeCents: slotFee(hour),
    capacity,
    booked: bookedCount,
    remaining: Math.max(0, capacity - bookedCount),
    status,
  };
}

export function listSlots(
  now: Date,
  timeZone: string,
  booked: Record<string, number>,
  capacity: number,
): Slot[] {
  const today = localParts(now, timeZone).date;
  const closedFirst = cutoffPassed(now, timeZone);
  const slots: Slot[] = [];
  for (let dayNumber = 1; dayNumber <= DATES_SHOWN; dayNumber++) {
    const date = addDays(today, dayNumber);
    for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
      const bookedCount = booked[`${date}T${twoDigits(hour)}`] ?? 0;
      const full = isFull(bookedCount, capacity);
      const status = slotStatus(dayNumber === 1, closedFirst, full);
      slots.push(makeSlot({ date, hour, bookedCount, capacity }, status));
    }
  }
  return slots;
}

export function parseSlotId(id: string): { date: string; hour: number } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})$/.exec(id);
  if (!match) {
    return null;
  }
  const hour = Number(match[2]);
  if (hour < FIRST_HOUR || hour > LAST_HOUR) {
    return null;
  }
  return { date: match[1], hour };
}
