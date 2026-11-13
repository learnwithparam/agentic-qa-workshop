// The planted bugs. Each one is a switch: BUGS=slot-cutoff bun run shop.
// BUGS=none is the fixed build. BUGS=release is the release candidate with every bug on.
export type Bug = {
  id: string;
  breaks: string; // the requirement it breaks, or "none written"
  what: string;
  group: "requirement" | "looks" | "api" | "unwritten" | "ai";
  caughtIn: string; // the step whose check expects the suite to catch it
};

export const BUGS: Bug[] = [
  {
    id: "slot-cutoff",
    breaks: "SLOT-3",
    group: "requirement",
    caughtIn: "catch-the-seeded-bugs",
    what:
      "Next-date slots stay bookable after the 22:00 cutoff, " +
      "because the cutoff reads the UTC hour, not the store hour.",
  },
  {
    id: "slot-capacity",
    breaks: "SLOT-2",
    group: "requirement",
    caughtIn: "catch-the-seeded-bugs",
    what: "Off by one: a slot that holds 20 orders takes a 21st.",
  },
  {
    id: "weighted-price",
    breaks: "BASK-4",
    group: "requirement",
    caughtIn: "catch-the-seeded-bugs",
    what: "Loose produce is rounded per 250 g step, so the line total drifts by a cent or more.",
  },
  {
    id: "promo-stacking",
    breaks: "BASK-7",
    group: "requirement",
    caughtIn: "catch-the-seeded-bugs",
    what: "The 10% voucher also discounts lines that carry a 3 for 2 offer.",
  },
  {
    id: "min-order",
    breaks: "BASK-8",
    group: "requirement",
    caughtIn: "catch-the-seeded-bugs",
    what: "Checkout stays open below the $25.00 minimum after an item is removed.",
  },
  {
    id: "ghost-line",
    breaks: "BASK-3",
    group: "requirement",
    caughtIn: "catch-the-seeded-bugs",
    what: "Removing the last unit leaves a line with quantity 0.",
  },
  {
    id: "sub-allergen",
    breaks: "SUB-4",
    group: "requirement",
    caughtIn: "catch-the-seeded-bugs",
    what: "The store picker substitutes an item that contains an allergen the shopper declared.",
  },
  {
    id: "sub-optout-chilled",
    breaks: "SUB-2",
    group: "requirement",
    caughtIn: "catch-the-seeded-bugs",
    what: '"No substitutes" is ignored for chilled items.',
  },
  {
    id: "price-overlap",
    breaks: "visual",
    group: "looks",
    caughtIn: "check-looks-and-access",
    what: "At 375 px wide a product price overlaps its Add button.",
  },
  {
    id: "missing-label",
    breaks: "accessibility",
    group: "looks",
    caughtIn: "check-looks-and-access",
    what: "The slot radio buttons have no accessible name.",
  },
  {
    id: "api-field-rename",
    breaks: "API contract",
    group: "api",
    caughtIn: "test-the-order-api-contract",
    what: "The order response returns slot_id where the contract says slotId.",
  },
  {
    id: "api-status",
    breaks: "API contract",
    group: "api",
    caughtIn: "test-the-order-api-contract",
    what: "Ordering into a full slot returns 500 where the contract says 409.",
  },
  {
    id: "double-book",
    breaks: "none written",
    group: "unwritten",
    caughtIn: "explore-with-an-agent",
    what: "A double click on Book slot books the slot twice and charges the fee twice.",
  },
  {
    id: "negative-qty",
    breaks: "none written",
    group: "unwritten",
    caughtIn: "explore-with-an-agent",
    what: "The quantity box accepts -1 and lowers the total.",
  },
  {
    id: "back-resubmit",
    breaks: "none written",
    group: "unwritten",
    caughtIn: "explore-with-an-agent",
    what: "Going back after checkout and pressing Checkout again places a second order.",
  },
  {
    id: "ai-allergen",
    breaks: "SUB-4",
    group: "ai",
    caughtIn: "test-the-substitution-suggester",
    what: "The suggester prompt drops the shopper's allergens, so some suggestions contain one.",
  },
];

export const BUG_IDS = BUGS.map((bug) => bug.id);
export const bugById = (id: string) => BUGS.find((bug) => bug.id === id);

// Read the switch once per process. "none" or empty: no bugs. "release": all of them.
export function parseBugs(raw: string | undefined): Set<string> {
  const setting = (raw ?? "none").trim();
  if (setting === "" || setting === "none") {
    return new Set();
  }
  if (setting === "release") {
    return new Set(BUG_IDS);
  }
  const names = setting.split(",");
  const ids = names.map((name) => name.trim()).filter(Boolean);
  for (const id of ids) {
    if (!bugById(id)) {
      throw new Error(`Unknown bug "${id}". Known bugs: ${BUG_IDS.join(", ")}`);
    }
  }
  return new Set(ids);
}

let active = parseBugs(process.env.BUGS);
export const bugIsOn = (id: string) => active.has(id);
export const activeBugs = () => [...active];
export const setBugs = (raw: string) => {
  active = parseBugs(raw);
};
