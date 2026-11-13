import { describe, expect, it } from "vitest";
import {
  CUTOFF_HOUR,
  cutoffPassed,
  DATES_SHOWN,
  FIRST_HOUR,
  isFull,
  LAST_HOUR,
  listSlots,
  parseSlotId,
  slotFee,
} from "./slots";

const UTC = "UTC";
const instant = (iso: string) => new Date(iso);

describe("constants", () => {
  it("has the documented slot window and cutoff", () => {
    expect(FIRST_HOUR).toBe(8);
    expect(LAST_HOUR).toBe(19);
    expect(CUTOFF_HOUR).toBe(22);
    expect(DATES_SHOWN).toBe(3);
  });
});

describe("slotFee (SLOT-5)", () => {
  it("charges 299 cents for the hour before peak", () => {
    expect(slotFee(16)).toBe(299);
  });
  it("charges 499 cents at 17:00", () => {
    expect(slotFee(17)).toBe(499);
  });
  it("charges 499 cents at 18:00", () => {
    expect(slotFee(18)).toBe(499);
  });
  it("charges 299 cents for the hour after peak", () => {
    expect(slotFee(19)).toBe(299);
  });
  it("charges 299 cents for the first slot", () => {
    expect(slotFee(8)).toBe(299);
  });
});

describe("cutoffPassed (SLOT-3)", () => {
  it("is false at 21:59", () => {
    expect(cutoffPassed(instant("2026-03-10T21:59:00Z"), UTC)).toBe(false);
  });
  it("is true at 22:00", () => {
    expect(cutoffPassed(instant("2026-03-10T22:00:00Z"), UTC)).toBe(true);
  });
  it("is true at 23:59", () => {
    expect(cutoffPassed(instant("2026-03-10T23:59:00Z"), UTC)).toBe(true);
  });
  it("is false at 00:00", () => {
    expect(cutoffPassed(instant("2026-03-10T00:00:00Z"), UTC)).toBe(false);
  });
  it("uses store time, not UTC", () => {
    // 21:30 UTC is 22:30 in Amsterdam (CET, UTC+1) in March before DST.
    expect(cutoffPassed(instant("2026-03-10T21:30:00Z"), "Europe/Amsterdam")).toBe(true);
    // 22:30 UTC is 17:30 in New York.
    expect(cutoffPassed(instant("2026-03-10T22:30:00Z"), "America/New_York")).toBe(false);
  });
});

describe("isFull (SLOT-2)", () => {
  it("is not full with 19 of 20 booked", () => {
    expect(isFull(19, 20)).toBe(false);
  });
  it("is full with 20 of 20 booked", () => {
    expect(isFull(20, 20)).toBe(true);
  });
  it("is full when overbooked", () => {
    expect(isFull(21, 20)).toBe(true);
  });
  it("is not full with nothing booked", () => {
    expect(isFull(0, 20)).toBe(false);
  });
});

const before = instant("2026-03-10T21:59:00Z");
const after = instant("2026-03-10T22:00:00Z");

describe("listSlots", () => {
  it("lists 12 hourly slots on each of the next 3 dates", () => {
    const slots = listSlots(before, UTC, {}, 20);
    expect(slots.length).toBe(36);
    expect(slots.map((slot) => slot.slotId).slice(0, 12)).toEqual([
      "2026-03-11T08",
      "2026-03-11T09",
      "2026-03-11T10",
      "2026-03-11T11",
      "2026-03-11T12",
      "2026-03-11T13",
      "2026-03-11T14",
      "2026-03-11T15",
      "2026-03-11T16",
      "2026-03-11T17",
      "2026-03-11T18",
      "2026-03-11T19",
    ]);
    expect(slots[12].slotId).toBe("2026-03-12T08");
    expect(slots[35].slotId).toBe("2026-03-13T19");
  });

  it("builds a full slot record", () => {
    const slots = listSlots(before, UTC, { "2026-03-11T08": 5 }, 20);
    expect(slots[0]).toEqual({
      slotId: "2026-03-11T08",
      date: "2026-03-11",
      start: "08:00",
      end: "09:00",
      dateText: "Wed, Mar 11",
      label: "Wed, Mar 11, 08:00 to 09:00",
      feeCents: 299,
      capacity: 20,
      booked: 5,
      remaining: 15,
      status: "open",
    });
  });
});

describe("listSlots: labels and counts", () => {
  it("formats the last slot and peak fee", () => {
    const slots = listSlots(before, UTC, {}, 20);
    expect(slots[11].start).toBe("19:00");
    expect(slots[11].end).toBe("20:00");
    expect(slots[11].label).toBe("Wed, Mar 11, 19:00 to 20:00");
    expect(slots[9].start).toBe("17:00");
    expect(slots[9].feeCents).toBe(499);
    expect(slots[10].feeCents).toBe(499);
    expect(slots[11].feeCents).toBe(299);
  });

  it("defaults booked to 0 for unbooked slots", () => {
    const slots = listSlots(before, UTC, {}, 20);
    expect(slots[3].booked).toBe(0);
    expect(slots[3].remaining).toBe(20);
    expect(slots[3].status).toBe("open");
  });
});

describe("listSlots: the cutoff and full slots", () => {
  it("keeps the first date open at 21:59", () => {
    const slots = listSlots(before, UTC, {}, 20);
    const firstDate = slots.slice(0, 12);
    const firstDateStatuses = firstDate.map((slot) => slot.status);
    expect(firstDateStatuses).toEqual(Array(12).fill("open"));
  });

  it("closes only the first date at 22:00", () => {
    const slots = listSlots(after, UTC, {}, 20);
    const firstDateStatuses = slots.slice(0, 12).map((slot) => slot.status);
    const laterStatuses = slots.slice(12).map((slot) => slot.status);
    expect(firstDateStatuses).toEqual(Array(12).fill("closed"));
    expect(laterStatuses).toEqual(Array(24).fill("open"));
  });

  it("shows closed rather than full on a closed first date", () => {
    const slots = listSlots(after, UTC, { "2026-03-11T10": 20 }, 20);
    expect(slots[2].status).toBe("closed");
  });

  it("marks a slot with 19 of 20 open and with 20 of 20 full", () => {
    const slots = listSlots(before, UTC, { "2026-03-12T09": 19, "2026-03-12T10": 20 }, 20);
    expect(slots[13].slotId).toBe("2026-03-12T09");
    expect(slots[13].status).toBe("open");
    expect(slots[13].remaining).toBe(1);
    expect(slots[14].status).toBe("full");
    expect(slots[14].remaining).toBe(0);
  });

  it("never shows negative remaining when overbooked", () => {
    const slots = listSlots(before, UTC, { "2026-03-12T09": 25 }, 20);
    expect(slots[13].remaining).toBe(0);
    expect(slots[13].booked).toBe(25);
    expect(slots[13].status).toBe("full");
  });

  it("marks full slots on the first date before the cutoff", () => {
    const slots = listSlots(before, UTC, { "2026-03-11T08": 20 }, 20);
    expect(slots[0].status).toBe("full");
  });

  it("uses the store date to choose the next dates", () => {
    // 23:30 UTC on Mar 10 is 00:30 on Mar 11 in Amsterdam: past midnight, so before the cutoff.
    const slots = listSlots(instant("2026-03-10T23:30:00Z"), "Europe/Amsterdam", {}, 20);
    expect(slots[0].slotId).toBe("2026-03-12T08");
    expect(slots[0].status).toBe("open");
  });
});

describe("parseSlotId", () => {
  it("parses a valid id", () => {
    expect(parseSlotId("2026-03-11T08")).toEqual({ date: "2026-03-11", hour: 8 });
  });
  it("accepts the last hour 19", () => {
    expect(parseSlotId("2026-03-11T19")).toEqual({ date: "2026-03-11", hour: 19 });
  });
  it("rejects hour 07", () => {
    expect(parseSlotId("2026-03-11T07")).toBe(null);
  });
  it("rejects hour 20", () => {
    expect(parseSlotId("2026-03-11T20")).toBe(null);
  });
  it("rejects a one-digit hour", () => {
    expect(parseSlotId("2026-03-11T8")).toBe(null);
  });
  it("rejects extra text at the start", () => {
    expect(parseSlotId("x2026-03-11T08")).toBe(null);
  });
  it("rejects extra text at the end", () => {
    expect(parseSlotId("2026-03-11T08x")).toBe(null);
  });
  it("rejects a malformed date", () => {
    expect(parseSlotId("26-03-11T08")).toBe(null);
    expect(parseSlotId("2026-3-11T08")).toBe(null);
    expect(parseSlotId("2026-03-1T08")).toBe(null);
    expect(parseSlotId("2026-03-11 08")).toBe(null);
    expect(parseSlotId("abcd-ef-ghTij")).toBe(null);
  });
});
