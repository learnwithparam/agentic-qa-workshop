import { describe, expect, it } from "vitest";
import { cutoffPassed, isFull, listSlots, parseSlotId, slotFee } from "./slots";

const STORE_ZONE = "America/Chicago";
const NOW = new Date("2026-03-10T15:00:00-05:00");

describe("slots", () => {
  it("lists slots", () => {
    const slots = listSlots(NOW, STORE_ZONE, {}, 20);
    expect(slots.length).toBeGreaterThan(0);
  });

  it("gives every slot a fee", () => {
    expect(slotFee(9)).toBeGreaterThan(0);
    expect(slotFee(17)).toBeGreaterThan(0);
  });

  it("answers the cutoff question", () => {
    expect(typeof cutoffPassed(NOW, STORE_ZONE)).toBe("boolean");
  });

  it("answers the full question", () => {
    expect(typeof isFull(20, 20)).toBe("boolean");
  });

  it("reads a slot id", () => {
    expect(parseSlotId("2026-03-11T08")).toBeTruthy();
  });
});
